import "server-only";
import { prisma } from "./db";
import { incomeByUser } from "./ledger";

/** Carrega tudo que a visão geral precisa de uma vez. */
export async function loadCoupleData(coupleId: string) {
  const [purchases, settlements, incomes, cards, bills, paidMarks] = await Promise.all([
    prisma.purchase.findMany({ where: { coupleId }, orderBy: { purchaseDate: "asc" } }),
    prisma.settlement.findMany({ where: { coupleId }, orderBy: { createdAt: "asc" } }),
    prisma.income.findMany({ where: { coupleId }, orderBy: { createdAt: "asc" } }),
    prisma.card.findMany({ where: { coupleId }, orderBy: { createdAt: "asc" } }),
    prisma.bill.findMany({ where: { coupleId }, orderBy: [{ dueDay: "asc" }, { name: "asc" }] }),
    prisma.paidMark.findMany({ where: { coupleId } }),
  ]);
  return { purchases, settlements, incomes, cards, bills, paidMarks };
}

export async function cardOptions(coupleId: string) {
  return prisma.card.findMany({
    where: { coupleId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, ownerId: true, closingDay: true, dueDay: true },
  });
}

/**
 * % da renda do casal de cada pessoa no mês (para mostrar a divisão "pela renda").
 * null se ninguém cadastrou renda (aí a divisão pela renda fica 50/50).
 */
export async function incomePercents(coupleId: string, memberIds: [string, string], month: string) {
  const incomes = await prisma.income.findMany({ where: { coupleId }, select: { userId: true, amountCents: true, startMonth: true, endMonth: true } });
  const income = incomeByUser(incomes, month, memberIds);
  const total = income[memberIds[0]] + income[memberIds[1]];
  if (!total) return null;
  const a = Math.round((income[memberIds[0]] / total) * 100);
  return { [memberIds[0]]: a, [memberIds[1]]: 100 - a } as Record<string, number>;
}
