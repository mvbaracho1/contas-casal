import { PageHeader } from "@/components/page-header";
import { PurchaseForm } from "@/components/purchase-form";
import { requireCouple } from "@/lib/auth";
import { cardOptions, incomePercents, receivablePeople } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export default async function NovaCompraPage({
  searchParams,
}: {
  /** amigo: "1" abre já como compra de amigo; outro valor = nome do amigo. mes: mês da fatura */
  searchParams: Promise<{ amigo?: string; mes?: string }>;
}) {
  const { couple, me, memberIds } = await requireCouple();
  const sp = await searchParams;
  const [cards, incomePct, people] = await Promise.all([
    cardOptions(couple.id),
    incomePercents(couple.id, memberIds, currentYm()),
    receivablePeople(couple.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const month = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : currentYm();
  const friend = sp.amigo ? (sp.amigo === "1" ? "" : sp.amigo.trim().slice(0, 80)) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={friend !== null ? "Compra de amigo" : "Nova compra"}
        subtitle={friend !== null ? "No cartão, Pix ou dinheiro: vai para “A receber”" : "À vista ou parcelada"}
        addButton={false}
      />
      <PurchaseForm
        members={couple.members}
        cards={cards}
        incomePct={incomePct}
        people={people}
        defaults={{
          firstMonth: month,
          purchaseDate: today,
          paidById: me.id,
          payerSharePct: friend !== null ? 100 : 50,
          friendName: friend,
        }}
      />
    </div>
  );
}
