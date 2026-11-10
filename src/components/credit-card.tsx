import { cardStyle } from "@/lib/finance";
import { formatBRL } from "@/lib/ledger";

/** Cartão de crédito desenhado, no estilo do mockup. */
export function CreditCard({
  name,
  owner,
  color,
  dueLabel,
  limitFreeCents,
  status,
  compact = false,
}: {
  name: string;
  owner: string;
  color: string;
  dueLabel: string;
  limitFreeCents?: number | null;
  status?: "Aberta" | "Paga" | "Sem fatura";
  compact?: boolean;
}) {
  return (
    <div
      className={`relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-4 text-white shadow-lg shadow-black/10 ${cardStyle(color).bg} ${compact ? "max-w-72" : ""}`}
    >
      {/* brilho */}
      <span aria-hidden className="pointer-events-none absolute -top-1/2 -right-1/4 size-full rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
          <p className="truncate text-[10px] text-white/70">{owner}</p>
        </div>
        {status && (
          <span className={`pill shrink-0 ${status === "Paga" ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20 text-white"}`}>{status}</span>
        )}
      </div>
      <div className="relative flex items-center gap-3">
        <span aria-hidden className="grid h-7 w-9 grid-cols-3 gap-px overflow-hidden rounded-md bg-amber-200/90 p-1">
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="rounded-[1px] bg-amber-400/70" />)}
        </span>
        <span aria-hidden className="text-lg text-white/70">)))</span>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div>
          <p className="text-[9px] tracking-wider text-white/60 uppercase">Vence</p>
          <p className="text-xs font-semibold">{dueLabel}</p>
        </div>
        {limitFreeCents !== undefined && limitFreeCents !== null && (
          <div className="text-right">
            <p className="text-[9px] tracking-wider text-white/60 uppercase">Limite livre</p>
            <p className="tabular text-xs font-semibold">{formatBRL(limitFreeCents)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
