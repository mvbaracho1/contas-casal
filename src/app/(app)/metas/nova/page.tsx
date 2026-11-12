import { GoalForm } from "@/components/goal-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emergencyFundSuggestion } from "@/lib/goals";
import { activeIn, currentYm } from "@/lib/ledger";

export const metadata = { title: "Nova meta · Contas do Casal" };

export default async function NovaMetaPage() {
  const { couple } = await requireCouple();
  const bills = await prisma.bill.findMany({ where: { coupleId: couple.id }, select: { amountCents: true, startMonth: true, endMonth: true } });
  const today = currentYm();
  const emergencyCents = emergencyFundSuggestion(bills.filter((b) => activeIn(b, today)).reduce((a, b) => a + b.amountCents, 0));
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Nova meta" subtitle="Viagem, reserva de emergência e o que mais vocês querem juntar" addButton={false} />
      <GoalForm emergencyCents={emergencyCents} defaults={{}} cancelHref="/metas" />
    </div>
  );
}
