import { CardForm } from "@/components/finance-forms";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";

export const metadata = { title: "Novo cartão · Contas do Casal" };

export default async function NovoCartaoPage() {
  const { couple, me } = await requireCouple();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Novo cartão" subtitle="Depois de salvar, você já pode importar a fatura" addButton={false} />
      <CardForm members={couple.members} defaults={{ ownerId: me.id }} cancelHref="/cartoes" />
    </div>
  );
}
