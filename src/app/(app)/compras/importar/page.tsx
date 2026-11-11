import { ImportStatement } from "@/components/import-statement";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardOptions, incomePercents } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export const metadata = { title: "Importar fatura · Contas do Casal" };

export default async function ImportarPage() {
  const { couple, me, memberIds } = await requireCouple();
  const [cards, incomePct, existing] = await Promise.all([
    cardOptions(couple.id),
    incomePercents(couple.id, memberIds, currentYm()),
    // para avisar o que já foi importado antes (mesma compra parcelada na fatura seguinte)
    prisma.purchase.findMany({
      where: { coupleId: couple.id },
      select: { description: true, totalCents: true, installments: true, firstMonth: true, cardId: true },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Importar fatura" subtitle="PDF, OFX ou CSV do cartão" addButton={false} />
      <ImportStatement members={couple.members} meId={me.id} cards={cards} existing={existing} defaultMonth={currentYm()} incomePct={incomePct} />
    </div>
  );
}
