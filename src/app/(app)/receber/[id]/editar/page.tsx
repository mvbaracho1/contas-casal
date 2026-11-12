import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReceivableForm } from "@/components/receivable-forms";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receivablePeople } from "@/lib/finance-data";

export const metadata = { title: "Editar valor a receber · Contas do Casal" };

export default async function EditarReceberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const [r, people] = await Promise.all([
    prisma.receivable.findFirst({ where: { id, coupleId: couple.id } }),
    receivablePeople(couple.id),
  ]);
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Editar valor a receber" subtitle={`${r.personName} · ${r.description}`} addButton={false} />
      <ReceivableForm
        members={couple.members}
        people={people}
        cancelHref={`/receber?ver=${r.id}`}
        defaults={{
          id: r.id, personName: r.personName, description: r.description, totalCents: r.totalCents,
          installments: r.installments, firstMonth: r.firstMonth, creditorId: r.creditorId, note: r.note,
          linkedPurchaseId: r.purchaseId,
        }}
      />
    </div>
  );
}
