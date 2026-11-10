"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, requireCouple, requireUser, startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBRL } from "@/lib/ledger";

export type FormState = { error?: string; ok?: string } | undefined;

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");

// ---------- Autenticação ----------

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "Já existe uma conta com esse e-mail" };
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });
  await startSession(user.id);
  redirect("/casal");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos" };
  }
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------- Casal ----------

function newInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
}

export async function createCouple(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.coupleId) return { error: "Você já faz parte de um casal" };
  const name = String(form.get("name") ?? "").trim() || `Casal de ${user.name}`;
  await prisma.couple.create({
    data: { name, inviteCode: newInviteCode(), members: { connect: { id: user.id } } },
  });
  revalidatePath("/casal");
  return { ok: "Casal criado! Envie o código de convite para seu par." };
}

export async function joinCouple(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.coupleId) return { error: "Você já faz parte de um casal" };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const couple = await prisma.couple.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });
  if (!couple) return { error: "Código não encontrado" };
  if (couple._count.members >= 2) return { error: "Esse casal já está completo" };
  await prisma.user.update({ where: { id: user.id }, data: { coupleId: couple.id } });
  redirect("/");
}

// ---------- Compras ----------

const purchaseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição"),
  category: z.string().trim().optional(),
  total: z.string(),
  installments: z.coerce.number().int().min(1).max(72),
  firstMonth: ym,
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  paidById: z.string().min(1),
  payerSharePct: z.coerce.number().int().min(0).max(100),
});

export async function savePurchase(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = purchaseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const totalCents = parseBRL(d.total);
  if (!totalCents) return { error: "Valor inválido" };
  if (!memberIds.includes(d.paidById)) return { error: "Pagador inválido" };

  const data = {
    description: d.description,
    category: d.category || null,
    totalCents,
    installments: d.installments,
    firstMonth: d.firstMonth,
    purchaseDate: new Date(`${d.purchaseDate}T12:00:00Z`),
    paidById: d.paidById,
    payerSharePct: d.payerSharePct,
  };

  const id = String(form.get("id") ?? "");
  if (id) {
    const res = await prisma.purchase.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Compra não encontrada" };
  } else {
    await prisma.purchase.create({ data: { ...data, coupleId: couple.id } });
  }
  revalidatePath("/", "layout");
  redirect(`/?mes=${d.firstMonth}`);
}

export async function deletePurchase(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.purchase.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  revalidatePath("/", "layout");
  redirect("/compras");
}

// ---------- Acertos (transferências) ----------

export async function addSettlement(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const month = ym.safeParse(form.get("month"));
  if (!month.success) return { error: "Mês inválido" };
  const fromId = String(form.get("fromId"));
  const toId = memberIds.find((m) => m !== fromId);
  if (!memberIds.includes(fromId) || !toId) return { error: "Pessoa inválida" };
  const amountCents = parseBRL(String(form.get("amount") ?? ""));
  if (!amountCents) return { error: "Valor inválido" };

  await prisma.settlement.create({
    data: {
      coupleId: couple.id,
      month: month.data,
      fromId,
      toId,
      amountCents,
      note: String(form.get("note") ?? "").trim() || null,
    },
  });
  revalidatePath("/");
  return { ok: "Transferência registrada" };
}

export async function deleteSettlement(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.settlement.deleteMany({
    where: { id: String(form.get("id")), coupleId: couple.id },
  });
  revalidatePath("/");
}
