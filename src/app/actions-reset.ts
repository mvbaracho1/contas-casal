"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { flash } from "@/lib/flash";

const PARTS = ["compras", "cartoes", "contas", "renda", "acertos", "receber", "metas"] as const;
type Part = (typeof PARTS)[number];

/**
 * Apaga os dados financeiros do casal (para recomeçar do zero).
 * As contas dos dois e o casal continuam. Exige digitar "APAGAR".
 */
export async function resetCoupleData(_: FormState, form: FormData): Promise<FormState> {
  const { couple } = await requireCouple();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "APAGAR") {
    return { error: "Digite APAGAR para confirmar." };
  }
  const parts = new Set(form.getAll("parts").map(String).filter((p): p is Part => (PARTS as readonly string[]).includes(p)));
  if (parts.size === 0) return { error: "Escolha o que apagar." };

  const coupleId = couple.id;
  // Ordem segura: o que depende de outros registros sai primeiro.
  await prisma.$transaction([
    ...(parts.has("receber") ? [prisma.receivable.deleteMany({ where: { coupleId } })] : []), // pagamentos saem em cascata
    ...(parts.has("metas") ? [prisma.goal.deleteMany({ where: { coupleId } })] : []), // aportes saem em cascata
    ...(parts.has("acertos") ? [prisma.settlement.deleteMany({ where: { coupleId } })] : []),
    ...(parts.has("compras") ? [prisma.purchase.deleteMany({ where: { coupleId } })] : []),
    ...(parts.has("contas") ? [prisma.bill.deleteMany({ where: { coupleId } })] : []), // marcas de "pago" em cascata
    ...(parts.has("cartoes") ? [prisma.card.deleteMany({ where: { coupleId } })] : []), // compras ficam sem cartão
    ...(parts.has("renda") ? [prisma.income.deleteMany({ where: { coupleId } })] : []),
  ]);

  await flash(parts.size === PARTS.length ? "Tudo apagado. Podem começar do zero! ✨" : "Dados apagados.");
  revalidatePath("/", "layout");
  redirect("/");
}
