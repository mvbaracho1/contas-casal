// Valores a receber de terceiros: parcelas, pagamentos e status. Lógica pura (testada).

import { addMonths, formatBRL, formatYm, splitInstallments, ymToIndex, type Ym } from "./ledger";

export interface ReceivableLike {
  personName: string;
  description: string;
  totalCents: number;
  installments: number;
  startInstallment: number;
  firstMonth: Ym;
}

/** pago | pago em parte | vencido | vence este mês | ainda vai vencer */
export type InstallmentStatus = "pago" | "parcial" | "vencido" | "este-mes" | "a-vencer";

export interface ScheduleRow {
  number: number;
  month: Ym;
  amountCents: number;
  paidCents: number;
  status: InstallmentStatus;
}

export interface ReceivableSummary {
  rows: ScheduleRow[];
  /** Total que o terceiro deve (só as parcelas a partir da inicial) */
  owedCents: number;
  paidCents: number;
  remainingCents: number;
  /** Parcelas de meses passados ainda não pagas */
  overdueCents: number;
  /** Vencido + o que vence neste mês */
  dueNowCents: number;
  /** Próxima parcela não quitada */
  next: ScheduleRow | null;
  status: "quitado" | "atrasado" | "em-dia";
}

/**
 * Distribui os pagamentos nas parcelas, da mais antiga para a mais nova,
 * e marca o status de cada uma em relação ao mês `today`.
 */
export function summarizeReceivable(r: ReceivableLike, payments: { amountCents: number }[], today: Ym): ReceivableSummary {
  const amounts = splitInstallments(r.totalCents, r.installments);
  const now = ymToIndex(today);
  let pool = payments.reduce((a, p) => a + p.amountCents, 0);
  const rows: ScheduleRow[] = [];
  for (let k = Math.max(1, r.startInstallment); k <= r.installments; k++) {
    const amountCents = amounts[k - 1];
    const paidCents = Math.min(pool, amountCents);
    pool -= paidCents;
    const month = addMonths(r.firstMonth, k - 1);
    const m = ymToIndex(month);
    const status: InstallmentStatus =
      paidCents >= amountCents ? "pago" : m < now ? "vencido" : paidCents > 0 ? "parcial" : m === now ? "este-mes" : "a-vencer";
    rows.push({ number: k, month, amountCents, paidCents, status });
  }
  const owedCents = rows.reduce((a, x) => a + x.amountCents, 0);
  const paidCents = rows.reduce((a, x) => a + x.paidCents, 0);
  const open = (x: ScheduleRow) => x.amountCents - x.paidCents;
  const overdueCents = rows.filter((x) => ymToIndex(x.month) < now).reduce((a, x) => a + open(x), 0);
  const dueNowCents = rows.filter((x) => ymToIndex(x.month) <= now).reduce((a, x) => a + open(x), 0);
  const remainingCents = owedCents - paidCents;
  return {
    rows,
    owedCents,
    paidCents,
    remainingCents,
    overdueCents,
    dueNowCents,
    next: rows.find((x) => x.paidCents < x.amountCents) ?? null,
    status: remainingCents <= 0 ? "quitado" : overdueCents > 0 ? "atrasado" : "em-dia",
  };
}

/** Mensagem de cobrança pronta para copiar ou mandar pelo WhatsApp. */
export function chargeMessage(r: ReceivableLike, s: ReceivableSummary) {
  const lines = [`Oi, ${r.personName.split(" ")[0]}! Tudo bem?`, `Passando para lembrar do *${r.description}*.`];
  const late = s.rows.filter((x) => x.status === "vencido");
  if (late.length) {
    lines.push(
      late.length === 1 && r.installments > 1
        ? `A parcela ${late[0].number}/${r.installments} (${formatYm(late[0].month).toLowerCase()}) está em aberto: ${formatBRL(late[0].amountCents - late[0].paidCents)}.`
        : `Está em aberto: ${formatBRL(s.overdueCents)}.`,
    );
  } else if (s.next) {
    const parc = r.installments > 1 ? `a parcela ${s.next.number}/${r.installments}` : "o valor";
    lines.push(`Em ${formatYm(s.next.month).toLowerCase()} vence ${parc}: ${formatBRL(s.next.amountCents - s.next.paidCents)}.`);
  }
  if (r.installments > 1 && s.remainingCents > 0) lines.push(`Total que falta: ${formatBRL(s.remainingCents)}.`);
  lines.push("Obrigado! 😊");
  return lines.join("\n");
}

/** Link do WhatsApp com a mensagem pronta (wa.me: gratuito, abre o app de quem clicou). */
export function whatsappLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
