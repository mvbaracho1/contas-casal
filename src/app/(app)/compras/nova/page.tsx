import { PageHeader } from "@/components/page-header";
import { PurchaseForm } from "@/components/purchase-form";
import { requireCouple } from "@/lib/auth";
import { cardOptions, incomePercents } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export default async function NovaCompraPage() {
  const { couple, me, memberIds } = await requireCouple();
  const [cards, incomePct] = await Promise.all([cardOptions(couple.id), incomePercents(couple.id, memberIds, currentYm())]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Nova compra" subtitle="À vista ou parcelada" addButton={false} />
      <PurchaseForm
        members={couple.members}
        cards={cards}
        incomePct={incomePct}
        defaults={{ firstMonth: currentYm(), purchaseDate: today, paidById: me.id, payerSharePct: 50 }}
      />
    </div>
  );
}
