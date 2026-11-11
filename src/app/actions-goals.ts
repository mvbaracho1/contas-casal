"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { flash } from "@/lib/flash";
import { GOAL_EMOJIS } from "@/lib/goals";
import { parseBRL } from "@/lib/ledger";

const goalSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome para a meta").max(60),
  emoji: z.enum(GOAL_EMOJIS).catch("🎯"),
  target: z.string(),
  targetMonth: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido"), z.literal("")]).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function saveGoal(_: FormState, form: FormData): Promise<FormState> {
  const { couple } = await requireCouple();
  const parsed = goalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const targetCents = parseBRL(d.target);
  if (!targetCents || targetCents <= 0) return { error: "Informe quanto vocês querem juntar" };

  const data = { name: d.name, emoji: d.emoji, targetCents, targetMonth: d.targetMonth || null, note: d.note || null };
  const id = String(form.get("id") ?? "");
  let goalId = id;
  if (id) {
    const res = await prisma.goal.updateMany({ where: { id, coupleId: couple.id }, data });
    if (res.count === 0) return { error: "Meta não encontrada" };
  } else {
    goalId = (await prisma.goal.create({ data: { ...data, coupleId: couple.id } })).id;
  }
  await flash(id ? "Meta atualizada" : `Meta “${d.name}” criada ${d.emoji}`);
  revalidatePath("/", "layout");
  redirect(`/metas?ver=${goalId}`);
}

export async function deleteGoal(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.goal.deleteMany({ where: { id: String(form.get("id")), coupleId: couple.id } });
  await flash("Meta excluída");
  revalidatePath("/", "layout");
  redirect("/metas");
}

/** Aporte (guardar) ou retirada de uma meta. */
export async function addGoalEntry(_: FormState, form: FormData): Promise<FormState> {
  const { couple, memberIds } = await requireCouple();
  const goal = await prisma.goal.findFirst({
    where: { id: String(form.get("goalId")), coupleId: couple.id },
    include: { entries: { select: { amountCents: true } } },
  });
  if (!goal) return { error: "Meta não encontrada" };
  const userId = String(form.get("userId") ?? "");
  if (!memberIds.includes(userId)) return { error: "Escolha quem guardou" };
  const cents = parseBRL(String(form.get("amount") ?? ""));
  if (!cents || cents <= 0) return { error: "Valor inválido" };
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida" };
  const withdraw = form.get("kind") === "retirada";
  const saved = goal.entries.reduce((a, e) => a + e.amountCents, 0);
  if (withdraw && cents > saved) return { error: "A retirada passa do que está guardado na meta" };

  await prisma.goalEntry.create({
    data: {
      goalId: goal.id,
      userId,
      amountCents: withdraw ? -cents : cents,
      date: new Date(`${date}T12:00:00Z`),
      note: String(form.get("note") ?? "").trim().slice(0, 200) || null,
    },
  });
  const reached = !withdraw && saved < goal.targetCents && saved + cents >= goal.targetCents;
  await flash(reached ? `Meta “${goal.name}” alcançada! 🎉` : withdraw ? "Retirada registrada" : "Aporte registrado");
  revalidatePath("/", "layout");
  return {};
}

export async function deleteGoalEntry(form: FormData) {
  const { couple } = await requireCouple();
  await prisma.goalEntry.deleteMany({ where: { id: String(form.get("id")), goal: { coupleId: couple.id } } });
  await flash("Lançamento excluído");
  revalidatePath("/", "layout");
}
