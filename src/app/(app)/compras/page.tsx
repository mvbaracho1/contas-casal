import Link from "next/link";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMonths, currentYm, formatBRL, formatYm, ymToIndex } from "@/lib/ledger";

function shareLabel(pct: number, payer: string, other: string) {
  if (pct === 50) return "Dividida 50/50";
  if (pct === 100) return `Só de ${payer}`;
  if (pct === 0) return `Só de ${other}`;
  return `${payer} ${pct}% · ${other} ${100 - pct}%`;
}

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { couple, names, memberIds } = await requireCouple();
  const { filtro = "ativas" } = await searchParams;

  const purchases = await prisma.purchase.findMany({
    where: { coupleId: couple.id },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  const now = ymToIndex(currentYm());
  const visible = purchases.filter((p) => {
    const lastIdx = ymToIndex(p.firstMonth) + p.installments - 1;
    return filtro === "todas" || lastIdx >= now;
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Compras</h1>
        <Link href="/compras/nova" className="btn">+ Nova compra</Link>
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/compras" className={filtro !== "todas" ? "btn-ghost bg-zinc-200 dark:bg-zinc-800" : "btn-ghost"}>Em aberto</Link>
        <Link href="/compras?filtro=todas" className={filtro === "todas" ? "btn-ghost bg-zinc-200 dark:bg-zinc-800" : "btn-ghost"}>Todas</Link>
      </div>

      {visible.length === 0 ? (
        <div className="card text-center text-zinc-500">Nenhuma compra por aqui ainda.</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => {
            const other = memberIds.find((m) => m !== p.paidById)!;
            const lastMonth = addMonths(p.firstMonth, p.installments - 1);
            const paidSoFar = Math.max(0, Math.min(p.installments, now - ymToIndex(p.firstMonth) + 1));
            return (
              <li key={p.id}>
                <Link href={`/compras/${p.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-emerald-400">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.description}
                      {p.category && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{p.category}</span>}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Pago por {names[p.paidById]} · {shareLabel(p.payerSharePct, names[p.paidById], names[other])}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {p.installments > 1
                        ? `${p.installments}x · ${formatYm(p.firstMonth)} → ${formatYm(lastMonth)} · ${paidSoFar}/${p.installments} faturas`
                        : `À vista · ${formatYm(p.firstMonth)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatBRL(p.totalCents)}</p>
                    {p.installments > 1 && <p className="text-xs text-zinc-500">{formatBRL(Math.round(p.totalCents / p.installments))}/mês</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
