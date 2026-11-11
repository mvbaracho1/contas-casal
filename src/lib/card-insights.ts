// Detalhamento e insights da fatura de um cartão. Lógica pura (testada).

import { addMonths, installmentLine, recurringActive, splitInstallments, ymToIndex, type IncomeContext, type InstallmentLine, type PurchaseLike, type Ym } from "./ledger";

export type CardPurchase = PurchaseLike & { cardId: string | null; recurring?: boolean; endMonth?: Ym | null };

export interface OpenInstallment {
  id: string;
  description: string;
  perInstallmentCents: number;
  /** parcelas que ainda vão cair depois deste mês */
  remainingCount: number;
  remainingCents: number;
  /** mês da última parcela */
  lastMonth: Ym;
}

export interface CardInsights {
  lines: InstallmentLine[];
  totalCents: number;
  composition: { avistaCents: number; parceladoCents: number; assinaturaCents: number };
  /** parte de cada pessoa do casal; `friends` = compras de terceiros (a receber) */
  byPerson: Record<string, number> & { friends: number };
  prevTotalCents: number;
  /** variação % contra o mês anterior (null se o anterior foi zero) */
  changePct: number | null;
  /** média das faturas dos 6 meses anteriores que tiveram valor */
  avgPrevCents: number;
  /** 5 meses antes, o atual e 6 depois */
  timeline: { ym: Ym; totalCents: number }[];
  subscriptions: { id: string; description: string; amountCents: number }[];
  subscriptionsMonthlyCents: number;
  openInstallments: OpenInstallment[];
  /** soma das parcelas que ainda vão cair depois deste mês */
  committedCents: number;
  /** próximo mês em que a fatura cai por fim de parcelamentos */
  nextRelief: { ym: Ym; cents: number; descriptions: string[] } | null;
  topPurchases: InstallmentLine[];
}

function invoiceTotal(purchases: CardPurchase[], month: Ym) {
  return purchases.reduce((a, p) => a + (installmentLine(p, month)?.amountCents ?? 0), 0);
}

export function cardInsights(
  allPurchases: CardPurchase[],
  cardId: string,
  month: Ym,
  memberIds: [string, string],
  friendPurchaseIds: Set<string>,
  ctx?: IncomeContext,
): CardInsights {
  const purchases = allPurchases.filter((p) => p.cardId === cardId);
  const byId = new Map(purchases.map((p) => [p.id, p]));
  const lines = purchases
    .map((p) => installmentLine(p, month, ctx))
    .filter((l): l is InstallmentLine => l !== null)
    .sort((a, b) => b.amountCents - a.amountCents);
  const totalCents = lines.reduce((a, l) => a + l.amountCents, 0);

  const composition = { avistaCents: 0, parceladoCents: 0, assinaturaCents: 0 };
  const byPerson = { [memberIds[0]]: 0, [memberIds[1]]: 0, friends: 0 } as Record<string, number> & { friends: number };
  for (const l of lines) {
    if (l.recurring) composition.assinaturaCents += l.amountCents;
    else if (l.of > 1) composition.parceladoCents += l.amountCents;
    else composition.avistaCents += l.amountCents;

    if (friendPurchaseIds.has(l.sourceId)) byPerson.friends += l.amountCents;
    else {
      const other = l.paidById === memberIds[0] ? memberIds[1] : memberIds[0];
      byPerson[l.paidById] += l.payerShareCents;
      byPerson[other] += l.otherShareCents;
    }
  }

  const prevTotalCents = invoiceTotal(purchases, addMonths(month, -1));
  const changePct = prevTotalCents > 0 ? Math.round(((totalCents - prevTotalCents) / prevTotalCents) * 1000) / 10 : null;
  const prev6 = [1, 2, 3, 4, 5, 6].map((n) => invoiceTotal(purchases, addMonths(month, -n))).filter((v) => v > 0);
  const avgPrevCents = prev6.length ? Math.round(prev6.reduce((a, b) => a + b, 0) / prev6.length) : 0;
  const timeline = Array.from({ length: 12 }, (_, i) => {
    const ym = addMonths(month, i - 5);
    return { ym, totalCents: invoiceTotal(purchases, ym) };
  });

  const subscriptions = purchases
    .filter((p) => p.recurring && recurringActive(p, month))
    .map((p) => ({ id: p.id, description: p.description, amountCents: p.totalCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const subscriptionsMonthlyCents = subscriptions.reduce((a, s) => a + s.amountCents, 0);

  // parcelamentos que continuam depois deste mês (inclui os que só começam no futuro)
  const m = ymToIndex(month);
  const openInstallments: OpenInstallment[] = [];
  for (const p of purchases) {
    if (p.recurring || p.installments <= 1) continue;
    const start = ymToIndex(p.firstMonth);
    const amounts = splitInstallments(p.totalCents, p.installments);
    const minK = (p.startInstallment ?? 1) - 1;
    const future = amounts.map((c, k) => ({ c, k })).filter(({ k }) => k >= minK && start + k > m);
    if (!future.length) continue;
    openInstallments.push({
      id: p.id,
      description: p.description,
      perInstallmentCents: amounts[future[0].k],
      remainingCount: future.length,
      remainingCents: future.reduce((a, x) => a + x.c, 0),
      lastMonth: addMonths(p.firstMonth, p.installments - 1),
    });
  }
  openInstallments.sort((a, b) => b.remainingCents - a.remainingCents);
  const committedCents = openInstallments.reduce((a, x) => a + x.remainingCents, 0);

  // Próximo alívio: o primeiro mês depois deste em que a fatura cai porque
  // algum parcelamento (ativo neste mês) terminou.
  const ending = lines
    .filter((l) => !l.recurring && l.of > 1)
    .map((l) => {
      const p = byId.get(l.sourceId)!;
      return { description: l.description, lastCents: l.amountCents, reliefYm: addMonths(p.firstMonth, p.installments) };
    });
  let nextRelief: CardInsights["nextRelief"] = null;
  if (ending.length) {
    const first = ending.reduce((a, b) => (ymToIndex(b.reliefYm) < ymToIndex(a.reliefYm) ? b : a)).reliefYm;
    const same = ending.filter((x) => x.reliefYm === first);
    nextRelief = { ym: first, cents: same.reduce((a, x) => a + x.lastCents, 0), descriptions: same.map((x) => x.description) };
  }

  return {
    lines,
    totalCents,
    composition,
    byPerson,
    prevTotalCents,
    changePct,
    avgPrevCents,
    timeline,
    subscriptions,
    subscriptionsMonthlyCents,
    openInstallments,
    committedCents,
    nextRelief,
    topPurchases: lines.filter((l) => !l.recurring).slice(0, 3),
  };
}
