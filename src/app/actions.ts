"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, requireCouple, requireUser, startSession } from "@/lib/auth";
import { INVITE_RESEND_COOLDOWN_MS, joinByCode, sendCoupleInvite } from "@/lib/couple-invite";
import { prisma } from "@/lib/db";
import { flash } from "@/lib/flash";
import { syncPurchaseReceivable } from "@/lib/receivable-sync";
import { addMonths, parseBRL } from "@/lib/ledger";

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
  // Veio de um link de convite: já entra no casal.
  const joined = form.get("invite") ? !(await joinByCode(user.id, form.get("invite"))) : false;
  await flash(joined ? "Conta criada e você já entrou no casal! 💑" : "Conta criada! Agora é só montar o casal.");
  redirect(joined ? "/" : "/casal");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) {
    return { error: "Essa conta entra com o Google. Use o botão do Google ou crie uma senha em “Esqueci minha senha”." };
  }
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos" };
  }
  await startSession(user.id);
  if (!user.coupleId && form.get("invite")) {
    const joined = !(await joinByCode(user.id, form.get("invite")));
    if (joined) await flash("Você entrou no casal! 💑");
    redirect(joined ? "/" : "/casal");
  }
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

const partnerEmail = z.string().trim().toLowerCase().email("Informe um e-mail válido para o seu par");

export async function createCouple(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.coupleId) return { error: "Você já faz parte de um casal" };
  const parsed = partnerEmail.safeParse(form.get("partnerEmail"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data === user.email) return { error: "Use o e-mail do seu par, não o seu" };

  const name = String(form.get("name") ?? "").trim() || `Casal de ${user.name}`;
  const couple = await prisma.couple.create({
    data: { name, inviteCode: newInviteCode(), inviteEmail: parsed.data, members: { connect: { id: user.id } } },
  });
  const sent = await sendCoupleInvite({ to: parsed.data, inviterName: user.name, coupleName: name, code: couple.inviteCode });
  if (sent) await prisma.couple.update({ where: { id: couple.id }, data: { inviteSentAt: new Date() } });
  await flash(sent ? `Casal criado! Convite enviado para ${parsed.data}` : "Casal criado. Mande o link do convite para seu par.", sent ? "success" : "info");
  revalidatePath("/", "layout");
  redirect("/casal");
}

/** Reenvia o convite (pode trocar o e-mail do par). */
export async function resendInvite(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.coupleId) return { error: "Crie o casal primeiro" };
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: user.coupleId },
    include: { _count: { select: { members: true } } },
  });
  if (couple._count.members >= 2) return { error: "O casal já está completo" };
  const parsed = partnerEmail.safeParse(form.get("partnerEmail"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data === user.email) return { error: "Use o e-mail do seu par, não o seu" };
  if (couple.inviteSentAt && Date.now() - couple.inviteSentAt.getTime() < INVITE_RESEND_COOLDOWN_MS) {
    return { error: "Aguarde um minuto antes de reenviar." };
  }

  const sent = await sendCoupleInvite({ to: parsed.data, inviterName: user.name, coupleName: couple.name, code: couple.inviteCode });
  await prisma.couple.update({
    where: { id: couple.id },
    data: { inviteEmail: parsed.data, ...(sent && { inviteSentAt: new Date() }) },
  });
  revalidatePath("/", "layout");
  if (sent) await flash(`Convite enviado para ${parsed.data}`);
  return sent
    ? {}
    : { error: "Não conseguimos enviar o e-mail agora. Mande o código ou o link abaixo para seu par." };
}

export async function joinCouple(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.coupleId) return { error: "Você já faz parte de um casal" };
  const error = await joinByCode(user.id, form.get("code"));
  if (error) return { error };
  await flash("Você entrou no casal! 💑");
  redirect("/");
}

// ---------- Compras ----------

const purchaseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição"),
  category: z.string().trim().optional(),
  total: z.string(),
  installments: z.coerce.number().int().min(1).max(72),
  startInstallment: z.coerce.number().int().min(1).max(72).default(1),
  firstMonth: ym,
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  paidById: z.string().min(1),
  /** "renda" = proporcional à renda; senão % de quem pagou */
  payerSharePct: z.union([z.literal("renda"), z.coerce.number().int().min(0).max(100)]),
  cardId: z.string().optional(),
});

export async function savePurchase(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const parsed = purchaseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.startInstallment > d.installments) return { error: "A parcela inicial passa do total de parcelas" };
  const totalCents = parseBRL(d.total);
  if (!totalCents) return { error: "Valor inválido" };
  if (!memberIds.includes(d.paidById)) return { error: "Pagador inválido" };

  let cardId: string | null = null;
  if (d.cardId) {
    const card = await prisma.card.findFirst({ where: { id: d.cardId, coupleId: couple.id } });
    if (!card) return { error: "Cartão inválido" };
    if (card.ownerId !== d.paidById) return { error: "Esse cartão é de outra pessoa" };
    cardId = card.id;
  }

  // Compra de um amigo no cartão: fica toda com quem pagou (não gera dívida no casal)
  // e o valor vai para "A receber".
  const friendName = String(form.get("friendName") ?? "").trim().slice(0, 80);

  const data = {
    description: d.description,
    category: d.category || null,
    totalCents,
    installments: d.installments,
    startInstallment: d.installments > 1 ? d.startInstallment : 1,
    firstMonth: d.firstMonth,
    purchaseDate: new Date(`${d.purchaseDate}T12:00:00Z`),
    paidById: d.paidById,
    payerSharePct: friendName ? 100 : d.payerSharePct === "renda" ? null : d.payerSharePct,
    cardId,
  };

  let id = String(form.get("id") ?? "");
  if (id) {
    if (!friendName) {
      const linked = await prisma.receivable.findFirst({ where: { purchaseId: id, coupleId: couple.id }, include: { _count: { select: { payments: true } } } });
      if (linked && linked._count.payments > 0) {
        return { error: `Essa compra tem pagamentos de ${linked.personName} registrados. Exclua o valor em “A receber” antes de mudar a divisão.` };
      }
    }
    const res = await prisma.purchase.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Compra não encontrada" };
  } else {
    id = (await prisma.purchase.create({ data: { ...data, coupleId: couple.id } })).id;
  }
  const syncError = await syncPurchaseReceivable({ ...data, id, coupleId: couple.id }, friendName);
  if (syncError) return { error: syncError };
  await flash(
    form.get("id")
      ? "Compra atualizada"
      : friendName ? `Compra adicionada · ${friendName} vai para “A receber”` : "Compra adicionada",
  );
  revalidatePath("/", "layout");
  redirect(`/?mes=${addMonths(d.firstMonth, d.installments > 1 ? d.startInstallment - 1 : 0)}`);
}

export async function deletePurchase(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.purchase.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  await flash("Compra excluída");
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
  await flash("Transferência registrada");
  revalidatePath("/", "layout");
  return {};
}

export async function deleteSettlement(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.settlement.deleteMany({
    where: { id: String(form.get("id")), coupleId: couple.id },
  });
  await flash("Transferência excluída");
  revalidatePath("/", "layout");
}
