import "server-only";
import { prisma } from "./db";

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
