import Link from "next/link";
import { ImportStatement } from "@/components/import-statement";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardOptions, incomePercents, receivablePeople } from "@/lib/finance-data";
import { currentYm } from "@/lib/ledger";

export const metadata = { title: "Importar fatura · Contas do Casal" };

export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ cartao?: string; novo?: string }> }) {
  const { couple, me, memberIds } = await requireCouple();
  const { cartao, novo } = await searchParams;
  const [cards, incomePct, people, existing] = await Promise.all([
    cardOptions(couple.id),
    incomePercents(couple.id, memberIds, currentYm()),
    receivablePeople(couple.id),
    // para avisar o que já foi importado antes (mesma compra parcelada na fatura seguinte)
    prisma.purchase.findMany({
      where: { coupleId: couple.id },
      select: { description: true, totalCents: true, installments: true, firstMonth: true, cardId: true, recurring: true, endMonth: true },
    }),
  ]);
  const preselected = cards.find((c) => c.id === cartao);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Importar fatura" subtitle="PDF, OFX ou CSV do cartão" addButton={false} />
      {preselected && novo && (
        <div className="card flex flex-wrap items-center gap-3 border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40">
          <span className="text-2xl" aria-hidden>💳</span>
          <p className="min-w-0 flex-1 text-sm text-emerald-900 dark:text-emerald-100">
            <b>{preselected.name}</b> cadastrado! Quer importar a fatura atual dele agora? Assim as compras e parcelas já entram no app.
          </p>
          <Link href="/cartoes" className="btn-ghost shrink-0 text-sm">Agora não</Link>
        </div>
      )}
      <ImportStatement
        key={preselected?.id ?? "todos"}
        members={couple.members} meId={me.id} cards={cards} existing={existing} defaultMonth={currentYm()} incomePct={incomePct} people={people}
        defaultCardId={preselected?.id}
      />
    </div>
  );
}
