import { PageHeader } from "@/components/page-header";
import { ReceivableForm } from "@/components/receivable-forms";
import { requireCouple } from "@/lib/auth";
import { receivablePeople } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export const metadata = { title: "Novo valor a receber · Contas do Casal" };

export default async function NovoReceberPage() {
  const { couple, me } = await requireCouple();
  const people = await receivablePeople(couple.id);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Novo valor a receber" subtitle="Algo que alguém de fora deve a vocês" addButton={false} />
      <ReceivableForm members={couple.members} people={people} defaults={{ firstMonth: currentYm(), creditorId: me.id }} cancelHref="/receber" />
    </div>
  );
}
