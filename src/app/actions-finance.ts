"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BILL_CATEGORIES, CARD_COLORS } from "@/lib/finance";
import { parseBRL } from "@/lib/ledger";
import type { FormState } from "./actions";

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");
const optYm = z.union([ym, z.literal("")]).optional();
const day = z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido");

function checkPeriod(start: string, end?: string) {
  if (end && end < start) return "O mês final precisa ser depois do inicial";
  return null;
}

function done(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

// ---------- Renda ----------

const incomeSchema = z.object({
  userId: z.string().min(1),
  description: z.string().trim().min(1, "Informe a descrição"),
  amount: z.string(),
  startMonth: ym,
  endMonth: optYm,
});

export async function saveIncome(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = incomeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const amountCents = parseBRL(d.amount);
  if (!amountCents) return { error: "Valor inválido" };
  if (!memberIds.includes(d.userId)) return { error: "Pessoa inválida" };
  const periodError = checkPeriod(d.startMonth, d.endMonth);
  if (periodError) return { error: periodError };

  const data = { userId: d.userId, description: d.description, amountCents, startMonth: d.startMonth, endMonth: d.endMonth || null };
  const id = String(form.get("id") ?? "");
  if (id) {
    const res = await prisma.income.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Renda não encontrada" };
  } else {
    await prisma.income.create({ data: { ...data, coupleId: couple.id } });
  }
  done("/renda");
}

export async function deleteIncome(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.income.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  done("/renda");
}

// ---------- Cartões ----------

const cardSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cartão"),
  ownerId: z.string().min(1),
  closingDay: day,
  dueDay: day,
  limit: z.string().optional(),
  color: z.enum(CARD_COLORS).default("black"),
});

export async function saveCard(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = cardSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!memberIds.includes(d.ownerId)) return { error: "Dono inválido" };
  let limitCents: number | null = null;
  if (d.limit?.trim()) {
    limitCents = parseBRL(d.limit);
    if (limitCents === null) return { error: "Limite inválido" };
  }

  const data = { name: d.name, ownerId: d.ownerId, closingDay: d.closingDay, dueDay: d.dueDay, limitCents, color: d.color };
  const id = String(form.get("id") ?? "");
  if (id) {
    const res = await prisma.card.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Cartão não encontrado" };
    // Se o dono mudou, as compras do cartão passam a ser pagas pelo novo dono.
    await prisma.purchase.updateMany({ where: { cardId: id, coupleId: couple.id }, data: { paidById: d.ownerId } });
  } else {
    await prisma.card.create({ data: { ...data, coupleId: couple.id } });
  }
  done("/cartoes");
}

export async function deleteCard(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.card.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  done("/cartoes");
}

// ---------- Contas fixas ----------

const billSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da conta"),
  category: z.enum(BILL_CATEGORIES).default("Outros"),
  amount: z.string(),
  dueDay: day,
  paidById: z.string().min(1),
  split: z.string(), // "renda" ou número 0-100 (parte de quem paga)
  startMonth: ym,
  endMonth: optYm,
});

export async function saveBill(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = billSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const amountCents = parseBRL(d.amount);
  if (!amountCents) return { error: "Valor inválido" };
  if (!memberIds.includes(d.paidById)) return { error: "Pagador inválido" };
  const periodError = checkPeriod(d.startMonth, d.endMonth);
  if (periodError) return { error: periodError };
  let payerSharePct: number | null = null;
  if (d.split !== "renda") {
    const n = Number(d.split);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { error: "Divisão inválida" };
    payerSharePct = n;
  }

  const data = {
    name: d.name, category: d.category, amountCents, dueDay: d.dueDay, paidById: d.paidById,
    payerSharePct, startMonth: d.startMonth, endMonth: d.endMonth || null,
  };
  const id = String(form.get("id") ?? "");
  if (id) {
    const res = await prisma.bill.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Conta não encontrada" };
  } else {
    await prisma.bill.create({ data: { ...data, coupleId: couple.id } });
  }
  done("/contas");
}

export async function deleteBill(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.bill.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  done("/contas");
}

// ---------- Marcar como pago (conta fixa ou fatura) ----------

export async function togglePaid(form: FormData) {
  const { couple } = await requireCouple();
  const month = ym.safeParse(form.get("month"));
  if (!month.success) return;
  const kind = String(form.get("kind"));
  const refId = String(form.get("refId"));

  if (kind === "bill") {
    if (!(await prisma.bill.count({ where: { id: refId, coupleId: couple.id } }))) return;
    const key = { billId_month: { billId: refId, month: month.data } };
    const existing = await prisma.paidMark.findUnique({ where: key });
    if (existing) await prisma.paidMark.delete({ where: { id: existing.id } });
    else await prisma.paidMark.create({ data: { coupleId: couple.id, month: month.data, billId: refId } });
  } else if (kind === "card") {
    if (!(await prisma.card.count({ where: { id: refId, coupleId: couple.id } }))) return;
    const key = { cardId_month: { cardId: refId, month: month.data } };
    const existing = await prisma.paidMark.findUnique({ where: key });
    if (existing) await prisma.paidMark.delete({ where: { id: existing.id } });
    else await prisma.paidMark.create({ data: { coupleId: couple.id, month: month.data, cardId: refId } });
  }
  revalidatePath("/");
}
