import Link from "next/link";
import { deleteSettlement } from "@/app/actions";
import { SettlementForm } from "@/components/settlement-form";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMonths, currentYm, formatBRL, formatYm, summarizeMonth, type Debt } from "@/lib/ledger";

function DebtText({ debt, names, verb }: { debt: Debt; names: Record<string, string>; verb: string }) {
  if (!debt.debtorId || !debt.creditorId) return <span>Tudo certo, ninguém deve nada 🎉</span>;
  return (
    <span>
      <b>{names[debt.debtorId]}</b> {verb} <b className="text-emerald-600">{formatBRL(debt.amountCents)}</b> para{" "}
      <b>{names[debt.creditorId]}</b>
    </span>
  );
}

export default async function ResumoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { couple, memberIds, names } = await requireCouple();
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentYm();

  const [purchases, settlements] = await Promise.all([
    prisma.purchase.findMany({ where: { coupleId: couple.id }, orderBy: { purchaseDate: "asc" } }),
    prisma.settlement.findMany({ where: { coupleId: couple.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const s = summarizeMonth(purchases, settlements, month, memberIds);
  const monthSettlements = settlements.filter((x) => x.month === month);
  const hasOlderPending = s.cumulative.amountCents !== s.monthPending.amountCents || s.cumulative.debtorId !== s.monthPending.debtorId;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/?mes=${addMonths(month, -1)}`} className="btn-ghost" aria-label="Mês anterior">←</Link>
        <h1 className="text-center text-xl font-bold sm:text-2xl">{formatYm(month)}</h1>
        <Link href={`/?mes=${addMonths(month, 1)}`} className="btn-ghost" aria-label="Próximo mês">→</Link>
      </div>

      <section className="card border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-sm font-medium text-zinc-500">Fechamento do mês</p>
        <p className="mt-1 text-lg sm:text-xl">
          <DebtText debt={s.monthPending} names={names} verb="deve enviar" />
        </p>
        {monthSettlements.length > 0 && (
          <p className="mt-1 text-sm text-zinc-500">
            Antes das transferências: <DebtText debt={s.monthDebt} names={names} verb="devia" />
          </p>
        )}
        {hasOlderPending && (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm dark:bg-amber-950">
            Somando meses anteriores ainda não acertados: <DebtText debt={s.cumulative} names={names} verb="deve" />
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {memberIds.map((id) => (
          <div key={id} className="card">
            <p className="font-semibold">{names[id]}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Pagou no cartão/conta</dt><dd>{formatBRL(s.paidBy[id])}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Parte que é sua</dt><dd className="font-semibold">{formatBRL(s.consumptionBy[id])}</dd></div>
            </dl>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Parcelas do mês</h2>
          <Link href="/compras/nova" className="btn">+ Compra</Link>
        </div>
        {s.lines.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma parcela neste mês.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-zinc-500">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-2 font-medium">Compra</th>
                  <th className="py-2 font-medium">Pagou</th>
                  <th className="py-2 text-right font-medium">Parcela</th>
                  <th className="px-5 py-2 text-right font-medium">Outro deve</th>
                </tr>
              </thead>
              <tbody>
                {s.lines.map((l) => {
                  const other = memberIds.find((m) => m !== l.paidById)!;
                  return (
                    <tr key={l.purchaseId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="px-5 py-2">
                        <Link href={`/compras/${l.purchaseId}`} className="hover:underline">{l.description}</Link>
                        {l.of > 1 && <span className="ml-1 text-xs text-zinc-400">{l.number}/{l.of}</span>}
                      </td>
                      <td className="py-2">{names[l.paidById]}</td>
                      <td className="py-2 text-right">{formatBRL(l.amountCents)}</td>
                      <td className="px-5 py-2 text-right">
                        {l.otherShareCents > 0 ? (
                          <span>{names[other]}: <b>{formatBRL(l.otherShareCents)}</b></span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Transferências do mês</h2>
        {monthSettlements.length > 0 && (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {monthSettlements.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {names[t.fromId]} → {names[t.toId]}: <b>{formatBRL(t.amountCents)}</b>
                  {t.note && <span className="text-zinc-500"> · {t.note}</span>}
                </span>
                <form action={deleteSettlement}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn-danger">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <SettlementForm
          month={month}
          members={couple.members}
          suggestedFromId={s.monthPending.debtorId ?? undefined}
          suggestedAmount={s.monthPending.amountCents ? (s.monthPending.amountCents / 100).toFixed(2).replace(".", ",") : undefined}
        />
      </section>
    </>
  );
}
