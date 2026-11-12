import { notFound } from "next/navigation";
import { BillForm } from "@/components/finance-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Editar conta fixa · Contas do Casal" };

export default async function EditarContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const b = await prisma.bill.findFirst({ where: { id, coupleId: couple.id } });
  if (!b) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Editar conta fixa" subtitle={b.name} addButton={false} />
      <BillForm
        members={couple.members}
        cancelHref="/contas"
        defaults={{
          id: b.id, name: b.name, category: b.category, amountCents: b.amountCents, dueDay: b.dueDay,
          paidById: b.paidById, payerSharePct: b.payerSharePct, startMonth: b.startMonth, endMonth: b.endMonth,
        }}
      />
    </div>
  );
}
