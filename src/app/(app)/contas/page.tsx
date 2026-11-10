import Link from "next/link";
import { deleteBill } from "@/app/actions-finance";
import { BillForm } from "@/components/finance-forms";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Avatar, Money } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BILL_CATEGORIES, BILL_EMOJI, splitLabel } from "@/lib/finance";
import { activeIn, currentYm, formatBRL, formatYm } from "@/lib/ledger";

export default async function ContasPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { couple, me, memberIds, names } = await requireCouple();
  const { editar } = await searchParams;
  const bills = await prisma.bill.findMany({ where: { coupleId: couple.id }, orderBy: [{ dueDay: "asc" }, { name: "asc" }] });
  const month = currentYm();
  const active = bills.filter((b) => activeIn(b, month));
  const total = active.reduce((a, b) => a + b.amountCents, 0);
  const editing = bills.find((b) => b.id === editar);

  const groups = BILL_CATEGORIES.map((cat) => ({ cat, items: bills.filter((b) => b.category === cat) })).filter((g) => g.items.length);
  const other = (id: string) => memberIds.find((m) => m !== id)!;

  return (
    <>
      <PageHeader title="Contas fixas" subtitle="Aluguel, condomínio, assinaturas e o que se repete todo mês" addButton={false} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="card flex items-start justify-between gap-3">
            <div>
              <h2 className="card-title">Total por mês</h2>
              <div className="mt-2"><Money cents={total} size="lg" /></div>
              <p className="muted text-xs">{active.length} conta{active.length === 1 ? "" : "s"} ativa{active.length === 1 ? "" : "s"} em {formatYm(month).toLowerCase()}</p>
            </div>
            <span className="text-4xl sm:text-5xl" aria-hidden>📅</span>
          </section>

          {bills.length === 0 && (
            <div className="card text-center">
              <p className="muted text-sm">Nenhuma conta fixa ainda. Comece pelo aluguel ou condomínio.</p>
            </div>
          )}

          {groups.map((g) => (
            <section key={g.cat} className="card">
              <h2 className="card-title flex items-center gap-2"><span aria-hidden>{BILL_EMOJI[g.cat]}</span> {g.cat}</h2>
              <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                {g.items.map((b) => {
                  const on = activeIn(b, month);
                  return (
                    <li key={b.id} className={`flex items-center gap-3 py-3 ${on ? "" : "opacity-60"}`}>
                      <Avatar name={names[b.paidById]} index={memberIds.indexOf(b.paidById)} size="sm" />
                      <Link href={`/contas?editar=${b.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="muted truncate text-xs">
                          Dia {b.dueDay} · paga {b.paidById === me.id ? "você" : names[b.paidById]} · {splitLabel(b.payerSharePct, names[b.paidById], names[other(b.paidById)])}
                          {!on && " · fora do período"}
                        </p>
                      </Link>
                      <span className="tabular text-sm font-semibold">{formatBRL(b.amountCents)}</span>
                      <form action={deleteBill}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="btn-icon size-8 hover:text-red-600" aria-label="Excluir conta"><IconTrash width={14} height={14} /></button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className={editing ? "order-first lg:order-none" : ""}>
          <BillForm
            key={editing?.id ?? "new"}
            members={couple.members}
            defaults={
              editing
                ? {
                    id: editing.id, name: editing.name, category: editing.category, amountCents: editing.amountCents, dueDay: editing.dueDay,
                    paidById: editing.paidById, payerSharePct: editing.payerSharePct, startMonth: editing.startMonth, endMonth: editing.endMonth,
                  }
                : { paidById: me.id, startMonth: month }
            }
          />
        </div>
      </div>
    </>
  );
}
