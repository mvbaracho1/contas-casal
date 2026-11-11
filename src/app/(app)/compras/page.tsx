import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ParamLink, ParamView } from "@/components/url-state";
import { Avatar, pct } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { splitLabel } from "@/lib/finance";
import { addMonths, currentYm, formatBRL, formatYm, ymToIndex } from "@/lib/ledger";


// O filtro (?filtro=todas) troca no navegador: as duas listas já vêm prontas do servidor.
export default async function ComprasPage() {
  const { couple, names, memberIds } = await requireCouple();

  const purchases = await prisma.purchase.findMany({
    where: { coupleId: couple.id },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    include: { receivable: { select: { personName: true } } },
  });
  const now = ymToIndex(currentYm());
  const active = purchases.filter((p) =>
    p.recurring ? !p.endMonth || ymToIndex(p.endMonth) >= now : ymToIndex(p.firstMonth) + p.installments - 1 >= now,
  );

  const seg = () => "rounded-lg px-3 py-1.5 text-xs font-semibold transition";
  const on = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white";
  const off = "text-zinc-500 hover:text-zinc-900 dark:hover:text-white";

  return (
    <>
      <PageHeader title="Compras" subtitle={`${active.length} em aberto · ${purchases.length} no total`} />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <ParamLink param="filtro" value="" className={seg()} activeClassName={on} inactiveClassName={off}>Em aberto</ParamLink>
            <ParamLink param="filtro" value="todas" className={seg()} activeClassName={on} inactiveClassName={off}>Todas</ParamLink>
          </div>
          <div className="flex gap-2">
            <Link href="/compras/importar" className="btn-outline py-2 text-sm">📄 Importar fatura</Link>
            <Link href="/compras/nova" className="btn sm:hidden">+ Nova</Link>
          </div>
        </div>

        {[
          { key: "", visible: active },
          { key: "todas", visible: purchases },
        ].map(({ key, visible }) => (
          <ParamView key={key || "ativas"} param="filtro" values={[key]}>
          {visible.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
              <p className="muted text-sm">Nenhuma compra por aqui ainda.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link href="/compras/nova" className="btn">Adicionar compra</Link>
                <Link href="/compras/importar" className="btn-outline py-2 text-sm">Importar fatura</Link>
              </div>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((p) => {
                const other = memberIds.find((m) => m !== p.paidById)!;
                const lastMonth = addMonths(p.firstMonth, p.installments - 1);
                const paidSoFar = Math.max(0, Math.min(p.installments, now - ymToIndex(p.firstMonth) + 1));
                return (
                  <li key={p.id}>
                    <Link
                      href={`/compras/${p.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <Avatar name={names[p.paidById]} index={memberIds.indexOf(p.paidById)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{p.description}</span>
                          {p.category && (
                            <span className="pill shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{p.category}</span>
                          )}
                        </p>
                        <p className="muted truncate text-xs">
                          Pago por {names[p.paidById]} ·{" "}
                          {p.receivable ? `🤝 De ${p.receivable.personName} · a receber` : splitLabel(p.payerSharePct, names[p.paidById], names[other])}
                        </p>
                        {p.recurring ? (
                          <p className="text-[11px] text-violet-600 dark:text-violet-400">
                            🔁 Mensal · desde {formatYm(p.firstMonth).toLowerCase()}
                            {p.endMonth ? ` até ${formatYm(p.endMonth).toLowerCase()}` : ""}
                          </p>
                        ) : p.installments > 1 ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <span className="block h-full rounded-full bg-blue-600" style={{ width: `${pct(paidSoFar, p.installments)}%` }} />
                            </span>
                            <span className="shrink-0 text-[11px] text-zinc-400">
                              {paidSoFar}/{p.installments} · até {formatYm(lastMonth)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-400">À vista · {formatYm(p.firstMonth)}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold">{formatBRL(p.totalCents)}{p.recurring && <span className="text-[11px] font-normal text-zinc-500">/mês</span>}</p>
                        {p.installments > 1 && (
                          <p className="tabular text-[11px] text-zinc-500">{p.installments}x {formatBRL(Math.round(p.totalCents / p.installments))}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          </ParamView>
        ))}
      </section>
    </>
  );
}
