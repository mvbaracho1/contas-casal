import "server-only";
import { prisma } from "./db";

type PurchaseData = {
  id: string;
  coupleId: string;
  description: string;
  totalCents: number;
  installments: number;
  startInstallment: number;
  firstMonth: string;
  paidById: string;
};

/**
 * Mantém o "a receber" de uma compra feita por terceiro igual à compra.
 * `friendName` vazio = a compra não é mais de terceiro (remove, se não houver pagamentos).
 * Devolve uma mensagem de erro, ou null.
 */
export async function syncPurchaseReceivable(p: PurchaseData, friendName: string): Promise<string | null> {
  const existing = await prisma.receivable.findUnique({ where: { purchaseId: p.id }, include: { _count: { select: { payments: true } } } });
  const name = friendName.trim();
  if (!name) {
    if (!existing) return null;
    if (existing._count.payments > 0) {
      return `Essa compra tem pagamentos de ${existing.personName} registrados. Exclua o valor em “A receber” antes de mudar a divisão.`;
    }
    await prisma.receivable.delete({ where: { id: existing.id } });
    return null;
  }
  const data = {
    personName: name.slice(0, 80),
    description: p.description,
    totalCents: p.totalCents,
    installments: p.installments,
    startInstallment: p.startInstallment,
    firstMonth: p.firstMonth,
    creditorId: p.paidById,
  };
  if (existing) await prisma.receivable.update({ where: { id: existing.id }, data });
  else await prisma.receivable.create({ data: { ...data, coupleId: p.coupleId, purchaseId: p.id } });
  return null;
}
