"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { flash } from "@/lib/flash";
import { activeIn, ymToIndex } from "@/lib/ledger";
import type { FormState } from "./actions";

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");

const openSchema = z.object({
  kind: z.enum(["purchase", "bill"], { message: "Lançamento inválido" }),
  sourceId: z.string().min(1),
  month: ym,
  reason: z.string().trim().min(3, "Escreva o motivo da contestação").max(500, "Use no máximo 500 caracteres"),
  /** nova divisão proposta: "100" = só de quem pagou, "50" = meio a meio, "renda" = pela renda */
  proposal: z.enum(["100", "50", "renda"], { message: "Escolha a nova divisão" }),
});

/** % de quem pagou para gravar (null = pela renda). */
const proposalPct = (proposal: string) => (proposal === "renda" ? null : Number(proposal));
const sameSplit = (pct: number | null, proposal: string) => (pct === null ? proposal === "renda" : String(pct) === proposal);

/**
 * Contesta um lançamento do acerto. Só quem deve a parte (quem não pagou) pode contestar,
 * e só pode haver uma contestação aberta por lançamento.
 */
export async function openDispute(_: FormState, form: FormData): Promise<FormState> {
  const { couple, me } = await requireCouple();
  const parsed = openSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { kind, sourceId, month, reason, proposal } = parsed.data;

  if (kind === "purchase") {
    const p = await prisma.purchase.findFirst({ where: { id: sourceId, coupleId: couple.id }, include: { receivable: { select: { id: true } } } });
    if (!p) return { error: "Compra não encontrada" };
    if (p.paidById === me.id) return { error: "Só quem não pagou pode contestar" };
    if (p.payerSharePct === 100 || p.receivable) return { error: "Essa compra não entra no acerto" };
    if (sameSplit(p.payerSharePct, proposal)) return { error: "Essa já é a divisão atual: escolha outra" };
    const idx = ymToIndex(month) - ymToIndex(p.firstMonth);
    const inMonth = p.recurring
      ? idx >= 0 && (!p.endMonth || ymToIndex(p.endMonth) >= ymToIndex(month))
      : idx >= (p.startInstallment ?? 1) - 1 && idx < p.installments;
    if (!inMonth) return { error: "Essa compra não está no acerto deste mês" };
    const open = await prisma.dispute.findFirst({ where: { coupleId: couple.id, purchaseId: p.id, status: "aberta" } });
    if (open) return { error: "Já existe uma contestação aberta para essa compra" };
  } else {
    const b = await prisma.bill.findFirst({ where: { id: sourceId, coupleId: couple.id } });
    if (!b) return { error: "Conta não encontrada" };
    if (b.paidById === me.id) return { error: "Só quem não pagou pode contestar" };
    if (b.payerSharePct === 100) return { error: "Essa conta não entra no acerto" };
    if (!activeIn(b, month)) return { error: "Essa conta não está no acerto deste mês" };
    if (sameSplit(b.payerSharePct, proposal)) return { error: "Essa já é a divisão atual: escolha outra" };
    const open = await prisma.dispute.findFirst({ where: { coupleId: couple.id, billId: b.id, month, status: { in: ["aberta", "aceita"] } } });
    if (open) return { error: open.status === "aceita" ? "Essa conta já saiu do acerto deste mês" : "Já existe uma contestação aberta para essa conta" };
  }

  await prisma.dispute.create({
    data: {
      coupleId: couple.id,
      kind,
      purchaseId: kind === "purchase" ? sourceId : null,
      billId: kind === "bill" ? sourceId : null,
      month,
      openedById: me.id,
      reason,
      proposal,
    },
  });
  await flash("Contestação enviada");
  revalidatePath("/", "layout");
  return {};
}

const resolveSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["aceitar", "recusar"], { message: "Escolha aceitar ou recusar" }),
  response: z.string().trim().max(500, "Use no máximo 500 caracteres").optional(),
});

/**
 * Responde a uma contestação. Só a outra pessoa (quem pagou) responde.
 * Aceitar: vale a divisão proposta — na compra inteira (todas as parcelas) ou na conta fixa só no mês
 * (a conta é lida em `Fixed.billSplits` a partir das contestações aceitas).
 */
export async function resolveDispute(_: FormState, form: FormData): Promise<FormState> {
  const { couple, me } = await requireCouple();
  const parsed = resolveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision, response } = parsed.data;

  const d = await prisma.dispute.findFirst({ where: { id, coupleId: couple.id }, include: { purchase: true } });
  if (!d || d.status !== "aberta") return { error: "Essa contestação já foi respondida" };
  if (d.openedById === me.id) return { error: "Quem responde é a outra pessoa" };
  if (decision === "recusar" && !response) return { error: "Explique por que está recusando" };

  const resolved = { status: decision === "aceitar" ? "aceita" : "recusada", response: response || null, resolvedById: me.id, resolvedAt: new Date() };
  if (decision === "aceitar" && d.purchase) {
    await prisma.$transaction([
      prisma.purchase.updateMany({ where: { id: d.purchase.id, coupleId: couple.id }, data: { payerSharePct: proposalPct(d.proposal) } }),
      prisma.dispute.updateMany({ where: { id: d.id, coupleId: couple.id }, data: { ...resolved, previousSharePct: d.purchase.payerSharePct } }),
    ]);
  } else {
    await prisma.dispute.updateMany({ where: { id: d.id, coupleId: couple.id }, data: resolved });
  }
  await flash(decision === "aceitar" ? "Contestação aceita · nova divisão aplicada" : "Contestação recusada");
  revalidatePath("/", "layout");
  return {};
}

/** Quem abriu pode desistir enquanto ninguém respondeu. */
export async function cancelDispute(form: FormData) {
  const { couple, me } = await requireCouple();
  await prisma.dispute.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id, openedById: me.id, status: "aberta" } });
  await flash("Você desistiu da contestação");
  revalidatePath("/", "layout");
}

