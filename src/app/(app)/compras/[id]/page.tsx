import { notFound } from "next/navigation";
import { deletePurchase } from "@/app/actions";
import { PurchaseForm } from "@/components/purchase-form";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const p = await prisma.purchase.findFirst({ where: { id, coupleId: couple.id } });
  if (!p) notFound();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar compra</h1>
        <form action={deletePurchase}>
          <input type="hidden" name="id" value={p.id} />
          <button className="btn-danger">Excluir</button>
        </form>
      </div>
      <PurchaseForm
        members={couple.members}
        defaults={{
          id: p.id,
          description: p.description,
          category: p.category,
          total: (p.totalCents / 100).toFixed(2).replace(".", ","),
          installments: p.installments,
          firstMonth: p.firstMonth,
          purchaseDate: p.purchaseDate.toISOString().slice(0, 10),
          paidById: p.paidById,
          payerSharePct: p.payerSharePct,
        }}
      />
    </>
  );
}
