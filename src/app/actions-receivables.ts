"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { flash } from "@/lib/flash";
import { currentYm, parseBRL } from "@/lib/ledger";
import { summarizeReceivable } from "@/lib/receivables";

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");

const receivableSchema = z.object({
  personName: z.string().trim().min(1, "Informe quem deve").max(80),
  description: z.string().trim().min(1, "Informe a descrição").max(200),
  total: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(72).optional(),
  firstMonth: ym.optional(),
  creditorId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

/** Cria ou edita um valor a receber. Se estiver ligado a uma compra, os valores vêm dela. */
export async function saveReceivable(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = receivableSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!memberIds.includes(d.creditorId)) return { error: "Escolha quem recebe" };

  const id = String(form.get("id") ?? "");
  const existing = id ? await prisma.receivable.findFirst({ where: { id, coupleId: couple.id } }) : null;
  if (id && !existing) return { error: "Registro não encontrado" };

  const base = { personName: d.personName, description: d.description, creditorId: d.creditorId, note: d.note || null };
  if (existing?.purchaseId) {
    // valores e parcelas acompanham a compra; aqui só muda nome, descrição e observação
    await prisma.receivable.update({ where: { id: existing.id }, data: { ...base, creditorId: existing.creditorId } });
  } else {
    const totalCents = parseBRL(d.total ?? "");
    if (!totalCents) return { error: "Valor inválido" };
    if (!d.firstMonth) return { error: "Informe o mês do 1º pagamento" };
    const data = { ...base, totalCents, installments: d.installments ?? 1, firstMonth: d.firstMonth };
    if (existing) await prisma.receivable.update({ where: { id: existing.id }, data });
    else {
      const created = await prisma.receivable.create({ data: { ...data, coupleId: couple.id } });
      await flash("Valor a receber adicionado");
      revalidatePath("/", "layout");
      redirect(`/receber?ver=${created.id}`);
    }
  }
  await flash("Valor a receber atualizado");
  revalidatePath("/", "layout");
  redirect(`/receber?ver=${existing!.id}`);
}

export async function deleteReceivable(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.receivable.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  await flash("Valor a receber excluído");
  revalidatePath("/", "layout");
  redirect("/receber");
}

/** Registra um pagamento (total ou parcial) recebido do terceiro. */
export async function addReceivablePayment(_: FormState, form: FormData): Promise<FormState> {
  const { couple } = await requireCouple();
  const r = await prisma.receivable.findFirst({
    where: { id: String(form.get("receivableId")), coupleId: couple.id },
    include: { payments: { select: { amountCents: true } } },
  });
  if (!r) return { error: "Registro não encontrado" };
  const amountCents = parseBRL(String(form.get("amount") ?? ""));
  if (!amountCents || amountCents <= 0) return { error: "Valor inválido" };
  const date = String(form.get("paidAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida" };

  const { remainingCents } = summarizeReceivable(r, r.payments, currentYm());
  if (amountCents > remainingCents) {
    return { error: `O valor passa do que falta receber (${(remainingCents / 100).toFixed(2).replace(".", ",")}).` };
  }
  await prisma.receivablePayment.create({
    data: { receivableId: r.id, amountCents, paidAt: new Date(`${date}T12:00:00Z`), note: String(form.get("note") ?? "").trim() || null },
  });
  await flash(amountCents === remainingCents ? "Recebido! Esse valor está quitado. 🎉" : "Recebimento registrado");
  revalidatePath("/", "layout");
  // estado vazio (sem erro) = sucesso; o formulário sugere o próximo valor
  return {};
}

export async function deleteReceivablePayment(form: FormData) {
  const { couple } = await requireCouple();
  const id = String(form.get("id"));
  await prisma.receivablePayment.deleteMany({ where: { id, receivable: { coupleId: couple.id } } });
  await flash("Recebimento excluído");
  revalidatePath("/", "layout");
}
