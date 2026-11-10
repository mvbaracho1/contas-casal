// Lógica pura de cálculo das contas do casal (sem banco, fácil de testar).

export type Ym = string; // "YYYY-MM"

export interface PurchaseLike {
  id: string;
  description: string;
  category?: string | null;
  totalCents: number;
  installments: number;
  firstMonth: Ym;
  paidById: string;
  payerSharePct: number;
}

export interface SettlementLike {
  id: string;
  month: Ym;
  fromId: string;
  toId: string;
  amountCents: number;
}

export interface BillLike {
  id: string;
  name: string;
  category?: string | null;
  amountCents: number;
  dueDay: number;
  paidById: string;
  /** null = proporcional à renda do casal */
  payerSharePct: number | null;
  startMonth: Ym;
  endMonth: Ym | null;
}

export interface IncomeLike {
  userId: string;
  amountCents: number;
  startMonth: Ym;
  endMonth: Ym | null;
}

export interface InstallmentLine {
  kind: "purchase" | "bill";
  /** id da compra ou da conta fixa */
  sourceId: string;
  description: string;
  category?: string | null;
  number: number; // 1-based
  of: number;
  amountCents: number;
  paidById: string;
  payerShareCents: number;
  otherShareCents: number; // quanto o outro deve a quem pagou
}

export interface Debt {
  debtorId: string | null;
  creditorId: string | null;
  amountCents: number;
}

export function ymToIndex(ym: Ym): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function indexToYm(i: number): Ym {
  const y = Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function addMonths(ym: Ym, n: number): Ym {
  return indexToYm(ymToIndex(ym) + n);
}

export function currentYm(date = new Date()): Ym {
  return indexToYm(date.getFullYear() * 12 + date.getMonth());
}

/** Divide o total em N parcelas; os centavos que sobram vão nas primeiras. */
export function splitInstallments(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

export function installmentLine(p: PurchaseLike, month: Ym): InstallmentLine | null {
  const k = ymToIndex(month) - ymToIndex(p.firstMonth);
  if (k < 0 || k >= p.installments) return null;
  const amountCents = splitInstallments(p.totalCents, p.installments)[k];
  const otherShareCents = Math.round((amountCents * (100 - p.payerSharePct)) / 100);
  return {
    kind: "purchase",
    sourceId: p.id,
    description: p.description,
    category: p.category,
    number: k + 1,
    of: p.installments,
    amountCents,
    paidById: p.paidById,
    payerShareCents: amountCents - otherShareCents,
    otherShareCents,
  };
}

export function linesForMonth(purchases: PurchaseLike[], month: Ym): InstallmentLine[] {
  return purchases
    .map((p) => installmentLine(p, month))
    .filter((l): l is InstallmentLine => l !== null);
}

/** Algo com vigência (renda, conta fixa) está ativo no mês? */
export function activeIn(x: { startMonth: Ym; endMonth: Ym | null }, month: Ym): boolean {
  const m = ymToIndex(month);
  return ymToIndex(x.startMonth) <= m && (!x.endMonth || m <= ymToIndex(x.endMonth));
}

/** Renda total de cada pessoa no mês. */
export function incomeByUser(incomes: IncomeLike[], month: Ym, memberIds: [string, string]): Record<string, number> {
  const out: Record<string, number> = { [memberIds[0]]: 0, [memberIds[1]]: 0 };
  for (const i of incomes) if (activeIn(i, month) && i.userId in out) out[i.userId] += i.amountCents;
  return out;
}

/** Parte (%) da renda do casal que é de `userId` (50 se ninguém cadastrou renda). */
export function incomeSharePct(income: Record<string, number>, userId: string): number {
  const total = Object.values(income).reduce((a, b) => a + b, 0);
  return total > 0 ? (income[userId] / total) * 100 : 50;
}

export function billLine(
  b: BillLike,
  month: Ym,
  income: Record<string, number>,
  memberIds: [string, string],
): InstallmentLine | null {
  if (!activeIn(b, month)) return null;
  const other = b.paidById === memberIds[0] ? memberIds[1] : memberIds[0];
  const otherPct = b.payerSharePct === null ? incomeSharePct(income, other) : 100 - b.payerSharePct;
  const otherShareCents = Math.round((b.amountCents * otherPct) / 100);
  return {
    kind: "bill",
    sourceId: b.id,
    description: b.name,
    category: b.category,
    number: 1,
    of: 1,
    amountCents: b.amountCents,
    paidById: b.paidById,
    payerShareCents: b.amountCents - otherShareCents,
    otherShareCents,
  };
}

export interface Fixed {
  bills: BillLike[];
  incomes: IncomeLike[];
}

/** Todas as linhas do mês: parcelas de compras + contas fixas. */
export function allLinesForMonth(
  purchases: PurchaseLike[],
  fixed: Fixed | undefined,
  month: Ym,
  memberIds: [string, string],
): InstallmentLine[] {
  const lines = linesForMonth(purchases, month);
  if (!fixed) return lines;
  const income = incomeByUser(fixed.incomes, month, memberIds);
  for (const b of fixed.bills) {
    const l = billLine(b, month, income, memberIds);
    if (l) lines.push(l);
  }
  return lines;
}

/**
 * Saldo líquido de A em relação a B: positivo = B deve a A.
 * Considera parcelas e transferências do mês informado.
 */
function netForMonth(
  purchases: PurchaseLike[],
  settlements: SettlementLike[],
  month: Ym,
  memberIds: [string, string],
  fixed?: Fixed,
): number {
  const aId = memberIds[0];
  let net = 0;
  for (const l of allLinesForMonth(purchases, fixed, month, memberIds)) {
    net += l.paidById === aId ? l.otherShareCents : -l.otherShareCents;
  }
  for (const s of settlements) {
    if (s.month !== month) continue;
    // B pagou A -> diminui o que B deve
    net += s.fromId === aId ? s.amountCents : -s.amountCents;
  }
  return net;
}

function toDebt(net: number, aId: string, bId: string): Debt {
  if (net === 0) return { debtorId: null, creditorId: null, amountCents: 0 };
  return net > 0
    ? { debtorId: bId, creditorId: aId, amountCents: net }
    : { debtorId: aId, creditorId: bId, amountCents: -net };
}

export interface MonthSummary {
  month: Ym;
  lines: InstallmentLine[];
  /** Total gasto pelo cartão/conta de cada um no mês */
  paidBy: Record<string, number>;
  /** Quanto do mês é de responsabilidade de cada um */
  consumptionBy: Record<string, number>;
  /** Só o mês (antes de transferências) */
  monthDebt: Debt;
  /** Mês já descontando transferências feitas no mês */
  monthPending: Debt;
  /** Acumulado de todos os meses até este (inclui pendências antigas) */
  cumulative: Debt;
}

export function summarizeMonth(
  purchases: PurchaseLike[],
  settlements: SettlementLike[],
  month: Ym,
  memberIds: [string, string],
  fixed?: Fixed,
): MonthSummary {
  const [aId, bId] = memberIds;
  const lines = allLinesForMonth(purchases, fixed, month, memberIds);

  const paidBy: Record<string, number> = { [aId]: 0, [bId]: 0 };
  const consumptionBy: Record<string, number> = { [aId]: 0, [bId]: 0 };
  let grossNet = 0;
  for (const l of lines) {
    const other = l.paidById === aId ? bId : aId;
    paidBy[l.paidById] += l.amountCents;
    consumptionBy[l.paidById] += l.payerShareCents;
    consumptionBy[other] += l.otherShareCents;
    grossNet += l.paidById === aId ? l.otherShareCents : -l.otherShareCents;
  }

  const pendingNet = netForMonth(purchases, settlements, month, memberIds, fixed);

  // Acumulado: do mês mais antigo com movimento até o mês atual
  const target = ymToIndex(month);
  let start = target;
  for (const p of purchases) start = Math.min(start, ymToIndex(p.firstMonth));
  for (const s of settlements) start = Math.min(start, ymToIndex(s.month));
  for (const b of fixed?.bills ?? []) start = Math.min(start, ymToIndex(b.startMonth));
  let cumNet = 0;
  for (let i = start; i <= target; i++) {
    cumNet += netForMonth(purchases, settlements, indexToYm(i), memberIds, fixed);
  }

  return {
    month,
    lines,
    paidBy,
    consumptionBy,
    monthDebt: toDebt(grossNet, aId, bId),
    monthPending: toDebt(pendingNet, aId, bId),
    cumulative: toDebt(cumNet, aId, bId),
  };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1.234,56" | "1234.56" | "1234,5" -> centavos */
export function parseBRL(input: string): number | null {
  const s = input.replace(/[R$\s]/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, ""); // "1.234"
  else normalized = s;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatYm(ym: Ym): string {
  const [y, m] = ym.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleString("pt-BR", { month: "long" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

/**
 * Mês da fatura em que cai uma compra feita em `date` num cartão.
 * Compras antes do dia de fechamento entram na fatura que fecha neste mês;
 * a partir do fechamento, na seguinte. Se o vencimento é antes do fechamento
 * (ex.: fecha 28, vence 5), a fatura vence no mês seguinte ao fechamento.
 */
export function invoiceMonthFor(date: string, closingDay: number, dueDay: number): Ym {
  const [y, m, d] = date.split("-").map(Number);
  let idx = y * 12 + (m - 1);
  if (d >= closingDay) idx += 1;
  if (dueDay <= closingDay) idx += 1;
  return indexToYm(idx);
}
