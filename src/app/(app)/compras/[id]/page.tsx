import { notFound } from "next/navigation";
import { deletePurchase } from "@/app/actions";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PurchaseForm } from "@/components/purchase-form";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardOptions, incomePercents, receivablePeople } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple, memberIds } = await requireCouple();
  const p = await prisma.purchase.findFirst({ where: { id, coupleId: couple.id }, include: { receivable: { select: { personName: true } } } });
  if (!p) notFound();
  const [cards, incomePct, people] = await Promise.all([
    cardOptions(couple.id),
    incomePercents(couple.id, memberIds, currentYm()),
    receivablePeople(couple.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Editar compra"
        subtitle={p.description}
        addButton={false}
        actions={
          <form action={deletePurchase}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn-danger"><IconTrash /> <span className="hidden sm:inline">Excluir</span></button>
          </form>
        }
      />
      <PurchaseForm
        members={couple.members}
        cards={cards}
        incomePct={incomePct}
        people={people}
        defaults={{
          id: p.id,
          description: p.description,
          category: p.category,
          total: (p.totalCents / 100).toFixed(2).replace(".", ","),
          installments: p.installments,
          startInstallment: p.startInstallment,
          firstMonth: p.firstMonth,
          purchaseDate: p.purchaseDate.toISOString().slice(0, 10),
          paidById: p.paidById,
          payerSharePct: p.payerSharePct,
          friendName: p.receivable?.personName ?? null,
          recurring: p.recurring,
          endMonth: p.endMonth,
          cardId: p.cardId,
        }}
      />
    </div>
  );
}
