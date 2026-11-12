import { notFound } from "next/navigation";
import { CardForm } from "@/components/finance-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Editar cartão · Contas do Casal" };

export default async function EditarCartaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const card = await prisma.card.findFirst({ where: { id, coupleId: couple.id } });
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Editar cartão" subtitle={card.name} addButton={false} />
      <CardForm
        members={couple.members}
        cancelHref="/cartoes"
        defaults={{ id: card.id, name: card.name, ownerId: card.ownerId, closingDay: card.closingDay, dueDay: card.dueDay, limitCents: card.limitCents, color: card.color }}
      />
    </div>
  );
}
