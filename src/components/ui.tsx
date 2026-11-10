// Peças visuais compartilhadas (server-safe).

/** Cores fixas por pessoa: 1ª do casal = azul, 2ª = rosa. */
export const MEMBER_COLORS = [
  { dot: "bg-blue-600", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-600", soft: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { dot: "bg-rose-500", text: "text-rose-500 dark:text-rose-400", bar: "bg-rose-500", soft: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
] as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ name, index, size = "md", className = "" }: { name: string; index: number; size?: "sm" | "md"; className?: string }) {
  const dim = size === "sm" ? "size-5 text-[9px]" : "size-8 text-xs";
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white dark:ring-zinc-900 ${dim} ${MEMBER_COLORS[index % 2].dot} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** Valor em reais com inteiro em destaque e centavos menores: R$ 5.304,28 */
export function Money({ cents, size = "lg", className = "" }: { cents: number; size?: "xl" | "lg" | "md"; className?: string }) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100).toLocaleString("pt-BR");
  const dec = String(abs % 100).padStart(2, "0");
  const s = {
    xl: { cur: "text-2xl sm:text-4xl", int: "text-4xl sm:text-6xl", dec: "text-lg sm:text-2xl" },
    lg: { cur: "text-lg sm:text-xl", int: "text-2xl sm:text-3xl", dec: "text-xs sm:text-sm" },
    md: { cur: "text-sm", int: "text-xl", dec: "text-xs" },
  }[size];
  return (
    <span className={`tabular inline-flex items-baseline gap-1 font-bold tracking-tight ${className}`}>
      <span className={`${s.cur} font-semibold text-zinc-400 dark:text-zinc-500`}>{neg && "−"}R$</span>
      <span className={s.int}>{int}</span>
      <span className={`${s.dec} -ml-1 font-medium text-zinc-500 dark:text-zinc-400`}>,{dec}</span>
    </span>
  );
}

/** Ilustração em "bolha" (emoji grande), no espírito dos ícones 3D do mockup. */
export function Illustration({ emoji, className = "" }: { emoji: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex size-14 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 text-3xl shadow-inner sm:size-20 sm:text-5xl dark:from-zinc-800 dark:to-zinc-900 ${className}`}
    >
      <span className="drop-shadow-[0_6px_8px_rgba(0,0,0,0.18)]">{emoji}</span>
    </span>
  );
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function fmtPct(n: number) {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
