import { BillForm } from "@/components/finance-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { currentYm } from "@/lib/ledger";

export const metadata = { title: "Nova conta fixa · Contas do Casal" };

export default async function NovaContaPage() {
  const { couple, me } = await requireCouple();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Nova conta fixa" subtitle="Aluguel, condomínio, luz e o que se repete todo mês" addButton={false} />
      <BillForm members={couple.members} defaults={{ paidById: me.id, startMonth: currentYm() }} cancelHref="/contas" />
    </div>
  );
}
