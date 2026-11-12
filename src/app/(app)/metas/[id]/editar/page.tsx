import { notFound } from "next/navigation";
import { GoalForm } from "@/components/goal-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emergencyFundSuggestion } from "@/lib/goals";
import { activeIn, currentYm } from "@/lib/ledger";

export const metadata = { title: "Editar meta · Contas do Casal" };

export default async function EditarMetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const [g, bills] = await Promise.all([
    prisma.goal.findFirst({ where: { id, coupleId: couple.id } }),
    prisma.bill.findMany({ where: { coupleId: couple.id }, select: { amountCents: true, startMonth: true, endMonth: true } }),
  ]);
  if (!g) notFound();
  const today = currentYm();
  const emergencyCents = emergencyFundSuggestion(bills.filter((b) => activeIn(b, today)).reduce((a, b) => a + b.amountCents, 0));
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Editar meta" subtitle={`${g.emoji} ${g.name}`} addButton={false} />
      <GoalForm
        emergencyCents={emergencyCents}
        cancelHref={`/metas?ver=${g.id}`}
        defaults={{ id: g.id, name: g.name, emoji: g.emoji, targetCents: g.targetCents, targetMonth: g.targetMonth, note: g.note }}
      />
    </div>
  );
}
