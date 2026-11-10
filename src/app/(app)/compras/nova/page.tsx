import { PurchaseForm } from "@/components/purchase-form";
import { requireCouple } from "@/lib/auth";
import { currentYm } from "@/lib/ledger";

export default async function NovaCompraPage() {
  const { couple, me } = await requireCouple();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <h1 className="text-2xl font-bold">Nova compra</h1>
      <PurchaseForm
        members={couple.members}
        defaults={{ firstMonth: currentYm(), purchaseDate: today, paidById: me.id, payerSharePct: 50 }}
      />
    </>
  );
}
