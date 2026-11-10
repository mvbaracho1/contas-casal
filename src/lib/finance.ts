// Constantes e cálculos de renda, cartões e contas fixas (puro, sem banco).
import { linesForMonth, splitInstallments, ymToIndex, type PurchaseLike, type Ym } from "./ledger";

export const CARD_COLORS = ["black", "orange", "purple", "blue", "green", "red"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const CARD_STYLES: Record<CardColor, { label: string; bg: string; swatch: string }> = {
  black: { label: "Grafite", bg: "bg-gradient-to-br from-zinc-700 via-zinc-900 to-black", swatch: "bg-zinc-900" },
  orange: { label: "Laranja", bg: "bg-gradient-to-br from-orange-400 to-orange-600", swatch: "bg-orange-500" },
  purple: { label: "Roxo", bg: "bg-gradient-to-br from-violet-500 to-purple-800", swatch: "bg-purple-600" },
  blue: { label: "Azul", bg: "bg-gradient-to-br from-sky-500 to-blue-800", swatch: "bg-blue-600" },
  green: { label: "Verde", bg: "bg-gradient-to-br from-emerald-500 to-teal-800", swatch: "bg-emerald-600" },
  red: { label: "Vermelho", bg: "bg-gradient-to-br from-rose-500 to-red-800", swatch: "bg-red-600" },
};

export function cardStyle(color: string) {
  return CARD_STYLES[(CARD_COLORS as readonly string[]).includes(color) ? (color as CardColor) : "black"];
}

export const BILL_CATEGORIES = ["Moradia", "Contas da casa", "Assinaturas", "Reserva", "Família", "Saúde", "Transporte", "Outros"] as const;

export const BILL_EMOJI: Record<string, string> = {
  Moradia: "🏠",
  "Contas da casa": "💡",
  Assinaturas: "📺",
  Reserva: "🐷",
  Família: "👨‍👩‍👧",
  Saúde: "🩺",
  Transporte: "🚗",
  Outros: "📌",
};

export function splitLabel(pct: number | null, payer: string, other: string) {
  if (pct === null) return "Proporcional à renda";
  if (pct === 50) return "Dividida 50/50";
  if (pct === 100) return `Só de ${payer}`;
  if (pct === 0) return `Só de ${other}`;
  return `${payer} ${pct}% · ${other} ${100 - pct}%`;
}

/** Data de vencimento (dia limitado ao fim do mês). */
export function dueDate(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(day, last));
}

type CardPurchase = PurchaseLike & { cardId: string | null };

/** Valor da fatura do cartão no mês (soma das parcelas). */
export function cardInvoice(purchases: CardPurchase[], cardId: string, month: Ym) {
  const lines = linesForMonth(purchases.filter((p) => p.cardId === cardId), month);
  return { totalCents: lines.reduce((a, l) => a + l.amountCents, 0), count: lines.length };
}

/** Quanto do limite ainda está comprometido: parcelas a partir de `fromMonth`. */
export function cardOutstanding(purchases: CardPurchase[], cardId: string, fromMonth: Ym) {
  const from = ymToIndex(fromMonth);
  let total = 0;
  for (const p of purchases) {
    if (p.cardId !== cardId) continue;
    const start = ymToIndex(p.firstMonth);
    splitInstallments(p.totalCents, p.installments).forEach((c, k) => {
      if (start + k >= from) total += c;
    });
  }
  return total;
}
