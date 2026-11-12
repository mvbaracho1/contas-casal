import Link from "next/link";
import { deleteSettlement } from "@/app/actions";
import { cancelDispute } from "@/app/actions-disputes";
import { DisputeOpen, DisputeResolve, type ProposalOption } from "@/components/dispute-forms";
import { togglePaid } from "@/app/actions-finance";
import { CollapsibleCard } from "@/components/collapsible-card";
import { CardsPanel } from "@/components/cards-panel";
import { ParamLink, ParamView } from "@/components/url-state";
import { CreditCard } from "@/components/credit-card";
import { IconAlert, IconArrowRight, IconArrowUpRight, IconCheck, IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuickSettle } from "@/components/quick-settle";
import { SettlementForm } from "@/components/settlement-form";
import { Avatar, fmtPct, Illustration, MEMBER_COLORS, Money, pct } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { BILL_EMOJI, cardInvoice, cardOutstanding, dueDate, splitLabel } from "@/lib/finance";
import { loadCoupleData } from "@/lib/finance-data";
import { addMonths, billMonthKey, currentYm, formatBRL, formatYm, incomeByUser, summarizeMonth, type InstallmentLine } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { summarizeReceivable } from "@/lib/receivables";
import { ConfirmButton } from "@/components/confirm-button";

function monthParts(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleString("pt-BR", { month: "long" });
  return { name: name.charAt(0).toUpperCase() + name.slice(1), short: name.slice(0, 3), year: y, m };
}

const centsToInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default async function VisaoGeralPage({
  searchParams,
}: {
  // quem, dia e cartao são lidos no navegador (url-state / cards-panel), sem recarregar a página
  searchParams: Promise<{ mes?: string; cartao?: string }>;
}) {
  const { couple, me, partner, memberIds, names } = await requireCouple();
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentYm();
  const idx = (id: string) => memberIds.indexOf(id);
  const who = (id: string) => (id === me.id ? "Você" : names[id]);

  const [{ purchases, settlements, incomes, cards, bills, paidMarks }, receivables, disputes] = await Promise.all([
    loadCoupleData(couple.id),
    prisma.receivable.findMany({ where: { coupleId: couple.id }, include: { payments: { select: { amountCents: true } } } }),
    prisma.dispute.findMany({
      where: { coupleId: couple.id },
      include: { purchase: { select: { description: true, paidById: true } }, bill: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  // contas fixas com contestação aceita: vale a divisão combinada naquele mês
  const proposalPct = (v: string) => (v === "renda" ? null : Number(v));
  const billSplits = disputes
    .filter((d) => d.status === "aceita" && d.billId)
    .map((d) => [billMonthKey(d.billId!, d.month), proposalPct(d.proposal)] as const);
  // Lembrete de cobrança: valores de terceiros vencidos (sempre em relação a hoje)
  const lateReceivables = receivables
    .map((r) => ({ r, s: summarizeReceivable(r, r.payments, currentYm()) }))
    .filter((x) => x.s.overdueCents > 0);
  const lateTotal = lateReceivables.reduce((a, x) => a + x.s.overdueCents, 0);
  const latePeople = [...new Set(lateReceivables.map((x) => x.r.personName.trim()))];

  // ---------- Compras de amigos (o que cada um deve na fatura do mês) ----------
  const friendItems = receivables.flatMap((r) => {
    const sum = summarizeReceivable(r, r.payments, currentYm());
    const row = sum.rows.find((x) => x.month === month);
    return row ? [{ r, row }] : [];
  });
  const friendGroups = [...friendItems.reduce((m, x) => {
    const key = x.r.personName.trim().toLowerCase();
    const g = m.get(key) ?? { name: x.r.personName.trim(), items: [] as typeof friendItems };
    g.items.push(x);
    return m.set(key, g);
  }, new Map<string, { name: string; items: typeof friendItems }>()).values()]
    .map((g) => {
      const amount = g.items.reduce((a, x) => a + x.row.amountCents, 0);
      const paid = g.items.reduce((a, x) => a + x.row.paidCents, 0);
      const late = g.items.some((x) => x.row.status === "vencido");
      return { ...g, amount, paid, late };
    })
    .sort((a, b) => b.amount - b.paid - (a.amount - a.paid));
  // compras de amigos ficam à parte: fora do saldo previsto e de "Compras do mês"
  const friendByPurchase = new Map(receivables.filter((r) => r.purchaseId).map((r) => [r.purchaseId!, r.personName.trim()]));
  const friendTotal = friendGroups.reduce((a, g) => a + g.amount, 0);
  const friendPaid = friendGroups.reduce((a, g) => a + g.paid, 0);
  // atalho "nova compra de amigo": já com o mês do painel (e o nome, nos chips de quem já comprou com vocês)
  const newFriendHref = (name?: string) => `/compras/nova?amigo=${encodeURIComponent(name || "1")}&mes=${month}`;
  const knownFriends = [...new Map(
    [...receivables]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => [r.personName.trim().toLowerCase(), r.personName.trim()] as const),
  ).values()].slice(0, 6);
  const friendOpenAll = receivables.reduce((a, r) => a + summarizeReceivable(r, r.payments, currentYm()).remainingCents, 0);
  const s = summarizeMonth(purchases, settlements, month, memberIds, { bills, incomes, billSplits });
  const monthSettlements = settlements.filter((x) => x.month === month);
  const pending = s.monthPending;
  // O que entra no acerto: linhas em que um deve uma parte ao outro (compras de amigos ficam fora)
  const settleLines = s.lines
    .filter((l) => (l.otherShareCents > 0 || l.waived) && !(l.kind === "purchase" && friendByPurchase.has(l.sourceId)))
    .map((l) => ({ ...l, net: l.paidById === me.id ? l.otherShareCents : -l.otherShareCents }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const settleGroups = [
    { title: "Compras", list: settleLines.filter((l) => l.kind === "purchase") },
    { title: "Contas fixas", list: settleLines.filter((l) => l.kind === "bill") },
  ].filter((g) => g.list.length > 0);
  const settleGross = sum(settleLines.map((l) => l.net));
  const settledNet = sum(monthSettlements.map((t) => (t.fromId === partner.id ? t.amountCents : -t.amountCents)));
  // ---------- Contestações ----------
  // a mais recente de cada lançamento: compra (vale para todas as parcelas) ou conta fixa no mês
  const disputeOf = (l: InstallmentLine) =>
    disputes.find((d) => (l.kind === "purchase" ? d.purchaseId === l.sourceId : d.billId === l.sourceId && d.month === month));
  const waitingMe = disputes.filter((d) => d.status === "aberta" && d.openedById !== me.id);
  // compras que saíram do acerto por contestação aceita neste mês ("só de quem pagou")
  const acceptedPurchases = disputes.filter((d) => d.status === "aceita" && d.purchaseId && d.month === month && d.proposal === "100");
  // divisões que dá para propor ("100" = só de quem pagou, "50", "renda"), em texto
  const rendaPayerPct = (payerId: string) => (coupleIncome > 0 ? Math.round((income[payerId] / coupleIncome) * 100) : 50);
  const splitText = (v: string, payerId: string) => {
    const otherId = memberIds.find((m) => m !== payerId)!;
    if (v === "100") return payerId === me.id ? "só sua" : `só de ${names[payerId]}`;
    if (v === "50") return "dividida 50/50";
    const pp = rendaPayerPct(payerId);
    return `pela renda (${payerId === me.id ? "você" : names[payerId]} ${pp}% · ${otherId === me.id ? "você" : names[otherId]} ${100 - pp}%)`;
  };
  const splitKey = (pct: number | null) => (pct === null ? "renda" : String(pct));
  const proposalOptions = (payerId: string, current: number | null): ProposalOption[] =>
    (["100", "50", "renda"] as const)
      .filter((v) => v !== splitKey(current))
      .map((v) => ({ value: v, label: splitText(v, payerId).replace(/^./, (c) => c.toUpperCase()) }));
  const acceptHint = (kind: string, proposal: string, payerId: string) =>
    kind === "purchase"
      ? `Se aceitar, a compra fica ${splitText(proposal, payerId)} em todas as parcelas.`
      : `Se aceitar, a conta fica ${splitText(proposal, payerId)} só em ${mp.name.toLowerCase()}.`;
  const signed = (net: number) => (net > 0 ? `${partner.name} te deve` : net < 0 ? `você deve a ${partner.name}` : "ninguém deve");
  const hasOlderPending =
    s.cumulative.amountCents !== pending.amountCents || s.cumulative.debtorId !== pending.debtorId;
  const mp = monthParts(month);
  const isCurrent = month === currentYm();

  // ---------- Minha parte de cada linha ----------
  const myShare = (l: InstallmentLine) => (l.paidById === me.id ? l.payerShareCents : l.otherShareCents);
  const billLines = s.lines.filter((l) => l.kind === "bill");
  const purchaseLines = s.lines.filter((l) => l.kind === "purchase" && !friendByPurchase.has(l.sourceId));
  const friendLines = s.lines.filter((l) => l.kind === "purchase" && friendByPurchase.has(l.sourceId));
  const isPersonal = (l: InstallmentLine) => l.payerShareCents === l.amountCents || l.otherShareCents === l.amountCents;
  // Contas divididas = as que os dois pagam juntos. "Só de um" ficam como contas pessoais.
  const billOf = (l: InstallmentLine) => bills.find((b) => b.id === l.sourceId);
  const houseLines = billLines.filter((l) => !isPersonal(l)).sort((a, b) => b.amountCents - a.amountCents);

  // ---------- Saldo previsto ----------
  const income = incomeByUser(incomes, month, memberIds);
  const myIncome = income[me.id];
  const coupleIncome = income[memberIds[0]] + income[memberIds[1]];
  const myHouse = sum(houseLines.map(myShare));
  const myPersonal = sum(billLines.filter(isPersonal).map(myShare));
  const myPurchases = sum(purchaseLines.map(myShare));
  const leftover = myIncome - myHouse - myPersonal - myPurchases;
  const barBase = Math.max(myIncome, myHouse + myPersonal + myPurchases, 1);
  const buckets = [
    { label: "Contas divididas", cents: myHouse, color: "bg-blue-900 dark:bg-blue-700" },
    { label: "Contas pessoais", cents: myPersonal, color: "bg-blue-600" },
    { label: "Compras", cents: myPurchases, color: "bg-sky-400" },
  ];

  // ---------- Contas a pagar (contas fixas + faturas) ----------
  const cardInvoices = cards.map((c) => ({ card: c, ...cardInvoice(purchases, c.id, month) }));
  const payables = [
    ...billLines.map((l) => {
      const b = bills.find((x) => x.id === l.sourceId)!;
      return { kind: "bill" as const, refId: b.id, name: b.name, amount: l.amountCents, dueDay: b.dueDay, payerId: b.paidById, emoji: BILL_EMOJI[b.category] ?? "📌" };
    }),
    ...cardInvoices
      .filter((ci) => ci.totalCents > 0)
      .map((ci) => ({ kind: "card" as const, refId: ci.card.id, name: `Fatura ${ci.card.name}`, amount: ci.totalCents, dueDay: ci.card.dueDay, payerId: ci.card.ownerId, emoji: "💳" })),
  ]
    .map((p) => ({
      ...p,
      paid: paidMarks.some((m) => m.month === month && (p.kind === "bill" ? m.billId === p.refId : m.cardId === p.refId)),
    }))
    .sort((a, b) => a.dueDay - b.dueDay || b.amount - a.amount);
  const payTotal = sum(payables.map((p) => p.amount));
  const paidCount = payables.filter((p) => p.paid).length;
  const days = [...new Set(payables.map((p) => p.dueDay))];
  const nextOpen = payables.find((p) => !p.paid);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToNext = nextOpen ? Math.round((dueDate(month, nextOpen.dueDay).getTime() - today.getTime()) / 86400000) : null;

  // ---------- Contas divididas ----------
  const houseTotal = sum(houseLines.map((l) => l.amountCents));
  const houseShare: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, sum(houseLines.map((l) => (l.paidById === id ? l.payerShareCents : l.otherShareCents)))]),
  );
  const houseNet = sum(houseLines.map((l) => (l.paidById === me.id ? l.otherShareCents : -l.otherShareCents)));
  const shareA = pct(houseShare[memberIds[0]], houseTotal);

  // ---------- Cartões ----------
  // cartão aberto no carrossel (a troca acontece no navegador; a URL só guarda a escolha)
  const selCard = cards.find((c) => c.id === sp.cartao) ?? cards[0];

  // ---------- Moradia ----------
  const housingLines = billLines.filter((l) => bills.find((b) => b.id === l.sourceId)?.category === "Moradia");
  const myHousing = sum(housingLines.map(myShare));
  const coupleHousing = sum(housingLines.map((l) => l.amountCents));
  const myHousingPct = myIncome ? (myHousing / myIncome) * 100 : 0;
  const coupleHousingPct = coupleIncome ? (coupleHousing / coupleIncome) * 100 : 0;

  // ---------- Compras do mês ----------
  // filtro "de quem" (todas as variações vão prontas; a troca é no navegador)
  const whoFilters = ["", ...memberIds];
  const linesOf = (id: string) => purchaseLines.filter((l) => !id || l.paidById === id).sort((a, b) => b.amountCents - a.amountCents);

  const empty = (text: string, href: string, cta: string) => (
    <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 p-5 text-center dark:border-zinc-700">
      <p className="muted text-sm">{text}</p>
      <Link href={href} className="btn mt-3">{cta}</Link>
    </div>
  );

  return (
    <>
      <PageHeader
        prevHref={`/?mes=${addMonths(month, -1)}`}
        nextHref={`/?mes=${addMonths(month, 1)}`}
        title={<>{mp.name} <span className="font-normal text-zinc-400">{mp.year}</span></>}
        actions={!isCurrent && <Link href="/" className="btn-outline">Hoje</Link>}
      />

      {lateTotal > 0 && (
        <Link
          href="/receber"
          className="flex items-center gap-3 rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-900 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950"
        >
          <span aria-hidden className="text-xl">🔔</span>
          <span className="min-w-0 flex-1">
            <b className="tabular">{formatBRL(lateTotal)}</b> vencido a receber de{" "}
            <span className="font-semibold">{latePeople.length <= 2 ? latePeople.join(" e ") : `${latePeople.slice(0, 2).join(", ")} e mais ${latePeople.length - 2}`}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold">Cobrar →</span>
        </Link>
      )}

      {/* Grid com linhas alinhadas: 1 coluna no celular, 2 no tablet, 3 no desktop. Os wrappers são "contents". */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* ================= Coluna principal ================= */}
        <div className="contents">
          {/* Saldo previsto */}
          <section className={`card order-1 flex min-w-0 flex-col md:col-span-2 ${payables.length > 2 ? "xl:min-h-[22rem]" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="card-title">Saldo previsto</h2>
                <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:gap-5">
                  <Money cents={leftover} size="xl" className={leftover < 0 ? "text-red-600 dark:text-red-400" : ""} />
                  <div className="sm:border-l sm:border-zinc-200 sm:pl-5 dark:sm:border-zinc-700">
                    {myIncome > 0 ? (
                      <p className={`flex items-center gap-1 text-sm font-semibold ${leftover >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        <IconArrowUpRight width={14} height={14} /> {fmtPct(Math.round((leftover / myIncome) * 1000) / 10)} do salário livre
                      </p>
                    ) : (
                      <Link href="/renda" className="text-sm font-semibold text-blue-600">Cadastre sua renda →</Link>
                    )}
                    <p className="muted text-xs">valor estimado depois de pagar todas as contas</p>
                  </div>
                </div>
              </div>
              <Illustration emoji="👛" />
            </div>
            <div className="h-5 shrink-0" />

            <div className="mt-auto flex h-2.5 shrink-0 gap-0.5 overflow-hidden rounded-full bg-zinc-100 pt-0 dark:bg-zinc-800">
              {buckets.map((b) => b.cents > 0 && <div key={b.label} className={b.color} style={{ width: `${(b.cents / barBase) * 100}%` }} />)}
              {leftover > 0 && <div className="bg-emerald-500" style={{ width: `${(leftover / barBase) * 100}%` }} />}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <dt className="muted">Sua renda</dt>
                <dd className="tabular mt-0.5 text-sm font-semibold">
                  <Link href="/renda" className="hover:underline">{formatBRL(myIncome)}</Link>
                </dd>
              </div>
              {buckets.map((b) => (
                <div key={b.label}>
                  <dt className="muted flex items-center gap-1.5 truncate"><span className={`size-1.5 shrink-0 rounded-full ${b.color}`} />{b.label}</dt>
                  <dd className="tabular mt-0.5 text-sm font-semibold">
                    − {formatBRL(b.cents)}
                    {myIncome > 0 && <span className="text-[11px] font-normal text-zinc-400"> · {fmtPct(Math.round((b.cents / myIncome) * 100))}</span>}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" />= Sobra</dt>
                <dd className={`tabular mt-0.5 text-sm font-semibold ${leftover >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatBRL(leftover)}
                </dd>
              </div>
            </dl>
          </section>

          <div className="contents">
            {/* Contas divididas entre o casal */}
            <section className="card order-3 flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="card-title">Contas divididas</h2>
                  <p className="muted mt-3 text-xs">Total das contas fixas que vocês dividem</p>
                  <Money cents={houseTotal} size="lg" />
                </div>
                <Illustration emoji="⚖️" />
              </div>

              {houseLines.length === 0 ? (
                empty(
                  "Nenhuma conta fixa dividida entre vocês. Contas marcadas como “Só de” um de vocês ficam em Contas pessoais.",
                  "/contas",
                  "Ver contas fixas",
                )
              ) : (
                <>
                  <div className="mt-4 flex justify-between gap-2 text-xs">
                    {memberIds.map((id, i) => (
                      <div key={id} className={i === 1 ? "text-right" : ""}>
                        <p className={`muted flex items-center gap-1.5 ${i === 1 ? "flex-row-reverse" : ""}`}>
                          <span className={`size-1.5 rounded-full ${MEMBER_COLORS[i].dot}`} />
                          {who(id)} paga
                        </p>
                        <p className="tabular mt-0.5 text-sm font-semibold">{formatBRL(houseShare[id])}</p>
                      </div>
                    ))}
                  </div>
                  <div className="relative mt-2">
                    <div className="flex h-6 overflow-hidden rounded-lg text-[10px] font-semibold text-white">
                      <div className="flex items-center bg-blue-600 px-2" style={{ width: `${shareA}%` }}>{shareA >= 15 && fmtPct(shareA)}</div>
                      <div className="flex flex-1 items-center justify-end bg-rose-500 px-2">{100 - shareA >= 15 && fmtPct(Math.round((100 - shareA) * 10) / 10)}</div>
                    </div>
                    <div className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-zinc-900 dark:bg-white" style={{ left: `${shareA}%` }} />
                  </div>

                  <h3 className="mt-5 text-xs font-semibold">Quem paga cada conta</h3>
                  <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {houseLines.map((l) => (
                      <li key={l.sourceId}>
                        <Link href={`/contas?editar=${l.sourceId}`} className="flex items-center gap-3 py-2.5 text-[13px]">
                          <span className={`size-2 shrink-0 rounded-full ${MEMBER_COLORS[idx(l.paidById)].dot}`} title={`Paga: ${names[l.paidById]}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{l.description}</span>
                            <span className="muted block truncate text-[11px]">
                              paga {l.paidById === me.id ? "você" : names[l.paidById]} · {splitLabel(billOf(l)?.payerSharePct ?? null, who(l.paidById), who(memberIds.find((m) => m !== l.paidById)!)).replace("Você", "você")}
                            </span>
                          </span>
                          <span className="tabular font-semibold">{formatBRL(l.amountCents)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-4">
                    <div className="-mx-4 flex items-center gap-2 border-t border-zinc-100 px-4 pt-4 text-xs sm:-mx-5 sm:px-5 dark:border-zinc-800">
                      {houseNet === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Cada um já paga exatamente a sua parte 🎉</span>
                      ) : (
                        <>
                          <Avatar name={houseNet > 0 ? partner.name : me.name} index={idx(houseNet > 0 ? partner.id : me.id)} size="sm" />
                          <IconArrowRight width={12} height={12} className="text-zinc-400" />
                          <Avatar name={houseNet > 0 ? me.name : partner.name} index={idx(houseNet > 0 ? me.id : partner.id)} size="sm" />
                          <span className="min-w-0">
                            {houseNet > 0 ? `${partner.name} te devolve` : `Você devolve a ${partner.name}`} <b>{formatBRL(Math.abs(houseNet))}</b>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Cartões */}
            <section className="card order-4 flex min-w-0 flex-col">
              {cards.length === 0 ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="card-title">Cartões</h2>
                      <p className="muted mt-3 truncate text-xs">Fatura de {mp.name.toLowerCase()}</p>
                      <Money cents={0} size="lg" />
                    </div>
                    <Illustration emoji="💳" />
                  </div>
                  {empty("Cadastre os cartões para acompanhar faturas e limites.", "/cartoes", "Adicionar cartão")}
                </>
              ) : (
                <CardsPanel
                  initialId={selCard!.id}
                  cards={cardInvoices.map((ci) => {
                    const paid = paidMarks.some((m) => m.cardId === ci.card.id && m.month === month);
                    return {
                      id: ci.card.id,
                      name: ci.card.name,
                      detailHref: `/cartoes/${ci.card.id}?mes=${month}`,
                      invoices: [0, 1, 2].map((n) => {
                        const ym = addMonths(month, n);
                        const parts = monthParts(ym);
                        return {
                          ym,
                          label: `${parts.short} ${String(parts.year).slice(2)}`,
                          name: parts.name.toLowerCase(),
                          totalCents: cardInvoice(purchases, ci.card.id, ym).totalCents,
                          detailHref: `/cartoes/${ci.card.id}?mes=${ym}`,
                        };
                      }),
                      node: (
                        <CreditCard
                          name={ci.card.name}
                          owner={who(ci.card.ownerId)}
                          color={ci.card.color}
                          dueLabel={`${String(ci.card.dueDay).padStart(2, "0")}/${String(mp.m).padStart(2, "0")}`}
                          limitFreeCents={ci.card.limitCents !== null ? ci.card.limitCents - cardOutstanding(purchases, ci.card.id, month) : null}
                          status={ci.count === 0 ? "Sem fatura" : paid ? "Paga" : "Aberta"}
                        />
                      ),
                    };
                  })}
                />
              )}
            </section>
          </div>

          {/* Acerto do mês */}
          <section id="acerto" className={`card order-7 flex min-w-0 flex-col gap-4 md:col-span-2 ${purchaseLines.length > 2 ? "xl:min-h-[28rem]" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="card-title">Acerto do mês</h2>
                <p className="muted text-xs">Compras + contas fixas, descontando as transferências</p>
                <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <Money cents={pending.amountCents} size="lg" />
                  {pending.debtorId ? (
                    <p className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <IconArrowUpRight width={14} height={14} />
                      {pending.debtorId === me.id ? `Você envia para ${partner.name}` : `${partner.name} te envia`}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <IconCheck width={14} height={14} /> Tudo certo, ninguém deve nada
                    </p>
                  )}
                </div>
              </div>
              {pending.debtorId && <QuickSettle month={month} fromId={pending.debtorId} amount={centsToInput(pending.amountCents)} />}
            </div>

            {waitingMe.length > 0 && (
              <a
                href={waitingMe.some((d) => d.month === month) ? "#contestacoes" : `/?mes=${waitingMe[0].month}#acerto`}
                className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <span aria-hidden>⚖️</span>
                <span className="flex-1">
                  <b>{partner.name}</b> contestou{" "}
                  <b>{waitingMe.length === 1 ? "1 lançamento" : `${waitingMe.length} lançamentos`}</b>
                  {waitingMe.every((d) => d.month === month) ? "" : ` (${[...new Set(waitingMe.map((d) => formatYm(d.month).toLowerCase()))].join(", ")})`}. Responda abaixo →
                </span>
              </a>
            )}

            {hasOlderPending && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <IconAlert className="mt-px shrink-0" width={14} height={14} />
                <span>
                  Somando meses anteriores ainda não acertados:{" "}
                  {s.cumulative.debtorId && s.cumulative.creditorId ? (
                    <><b>{names[s.cumulative.debtorId]}</b> deve <b>{formatBRL(s.cumulative.amountCents)}</b> para <b>{names[s.cumulative.creditorId]}</b>.</>
                  ) : (
                    <>tudo zerado.</>
                  )}
                </span>
              </p>
            )}

            {(settleLines.length > 0 || acceptedPurchases.length > 0) && (
              <details open className="group rounded-xl border border-zinc-200/70 dark:border-zinc-800">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">
                    O que entra no acerto <span className="font-normal text-zinc-400">· {settleLines.length}</span>
                  </span>
                  <span className="text-xs text-blue-600 group-open:hidden dark:text-blue-400">Ver</span>
                  <span className="hidden text-xs text-blue-600 group-open:inline dark:text-blue-400">Ocultar</span>
                </summary>
                <div className="border-t border-zinc-100 px-4 pb-3 dark:border-zinc-800">
                  {settleGroups.map((g) => (
                    <div key={g.title}>
                      <h3 className="mt-3 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{g.title}</h3>
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {g.list.map((l) => {
                          const pctVal = l.kind === "purchase"
                            ? purchases.find((p) => p.id === l.sourceId)?.payerSharePct ?? null
                            : l.splitOverride !== undefined ? l.splitOverride : billOf(l)?.payerSharePct ?? null;
                          const otherId = memberIds.find((m) => m !== l.paidById)!;
                          return (
                            <li key={`${l.kind}-${l.sourceId}`} className="py-2.5">
                              <Link
                                href={l.kind === "purchase" ? `/compras/${l.sourceId}` : `/contas?editar=${l.sourceId}`}
                                className="flex items-center gap-3 text-[13px]"
                              >
                                <span className={`size-2 shrink-0 rounded-full ${MEMBER_COLORS[idx(l.paidById)].dot}`} title={`Pagou: ${names[l.paidById]}`} />
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate ${l.waived ? "text-zinc-400 line-through" : ""}`}>
                                    {l.description}
                                    {l.of > 1 && <span className="muted"> · {l.number}/{l.of}</span>}
                                    {l.recurring && <span className="muted"> · 🔁</span>}
                                  </span>
                                  <span className="muted block truncate text-[11px]">
                                    {formatBRL(l.amountCents)} · pagou {l.paidById === me.id ? "você" : names[l.paidById]} ·{" "}
                                    {l.waived ? "fora do acerto neste mês" : splitLabel(pctVal, who(l.paidById), who(otherId)).replace("Você", "você")}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className={`tabular block font-semibold ${l.net > 0 ? "text-emerald-600 dark:text-emerald-400" : l.net < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-400"}`}>
                                    {l.net > 0 ? "+" : l.net < 0 ? "−" : ""} {formatBRL(Math.abs(l.net))}
                                  </span>
                                  <span className="muted block text-[10px]">{l.net > 0 ? `${partner.name} deve` : l.net < 0 ? "você deve" : "ninguém deve"}</span>
                                </span>
                              </Link>
                              {(() => {
                                const d = disputeOf(l);
                                const payer = l.paidById === me.id ? "você" : names[l.paidById];
                                const iOwe = l.paidById !== me.id;
                                const options = proposalOptions(l.paidById, pctVal);
                                // compra: pode contestar de novo depois de respondida; conta fixa: uma aceita por mês
                                const canOpen = iOwe && !l.waived && options.length > 0 && (!d || d.status === "recusada" || (d.status === "aceita" && l.kind === "purchase"));
                                return (
                                  <div className="ml-5 mt-1 space-y-1 text-[11px]">
                                    {d?.status === "aberta" && (
                                      <div id={d.openedById !== me.id ? "contestacoes" : undefined} className="scroll-mt-20 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                        <p>
                                          <b>⚖️ {d.openedById === me.id ? "Você contestou" : `${names[d.openedById]} contestou`}</b>
                                          {d.month !== month && <span className="text-amber-700 dark:text-amber-300"> em {formatYm(d.month).toLowerCase()}</span>}: “{d.reason}”
                                        </p>
                                        <p className="mt-0.5">Proposta: <b>{splitText(d.proposal, l.paidById)}</b></p>
                                        {d.openedById === me.id ? (
                                          <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="text-amber-700 dark:text-amber-300">Aguardando {names[l.paidById]} responder.</span>
                                            <form action={cancelDispute}>
                                              <input type="hidden" name="id" value={d.id} />
                                              <ConfirmButton
                                                className="font-semibold text-amber-800 hover:underline dark:text-amber-300"
                                                title="Desistir da contestação?" confirmLabel="Desistir"
                                                message={<>A contestação de <b>{l.description}</b> será apagada e o lançamento continua no acerto.</>}
                                              >
                                                Desistir
                                              </ConfirmButton>
                                            </form>
                                          </div>
                                        ) : (
                                          <DisputeResolve id={d.id} hint={acceptHint(l.kind, d.proposal, l.paidById)} />
                                        )}
                                      </div>
                                    )}
                                    {d?.status === "recusada" && (
                                      <p className="text-zinc-500 dark:text-zinc-400">
                                        ✕ Contestação recusada por {d.resolvedById === me.id ? "você" : names[d.resolvedById!]}
                                        {d.response && <>: “{d.response}”</>}
                                      </p>
                                    )}
                                    {d?.status === "aceita" && (
                                      <p className="text-emerald-700 dark:text-emerald-400">
                                        ✓ Contestação aceita ({splitText(d.proposal, l.paidById)}
                                        {l.kind === "bill" ? ` em ${mp.name.toLowerCase()}` : ""}): “{d.reason}”{d.response && <> · {d.response}</>}
                                      </p>
                                    )}
                                    {canOpen && (
                                      <DisputeOpen
                                        kind={l.kind} sourceId={l.sourceId} month={month} payerName={payer} options={options}
                                        hint={l.kind === "purchase" ? "Se aceitar, vale para todas as parcelas." : `Se aceitar, vale só para ${mp.name.toLowerCase()}.`}
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {acceptedPurchases.length > 0 && (
                    <div className="mt-3 rounded-xl bg-emerald-50/70 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <p className="font-semibold">✓ Contestações aceitas neste mês</p>
                      <ul className="mt-1 space-y-0.5">
                        {acceptedPurchases.map((d) => (
                          <li key={d.id}>
                            <Link href={`/compras/${d.purchaseId}`} className="hover:underline">{d.purchase?.description}</Link>
                            {" "}agora é {splitText("100", d.purchase!.paidById)} · “{d.reason}”
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <dl className="tabular mt-2 space-y-1 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
                    <div className="flex justify-between gap-3">
                      <dt className="muted">Soma do mês</dt>
                      <dd className="font-semibold">{formatBRL(Math.abs(settleGross))} <span className="font-normal text-zinc-400">· {signed(settleGross)}</span></dd>
                    </div>
                    {monthSettlements.length > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="muted">Transferências do mês</dt>
                        <dd>− {formatBRL(Math.abs(settledNet))}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </details>
            )}

            {monthSettlements.length > 0 && (
              <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                {monthSettlements.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span className="flex shrink-0 items-center gap-1">
                      <Avatar name={names[t.fromId]} index={idx(t.fromId)} size="sm" />
                      <IconArrowRight width={12} height={12} className="text-zinc-400" />
                      <Avatar name={names[t.toId]} index={idx(t.toId)} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {names[t.fromId]} → {names[t.toId]}
                      {t.note && <span className="muted"> · {t.note}</span>}
                    </span>
                    <span className="tabular font-semibold">{formatBRL(t.amountCents)}</span>
                    <form action={deleteSettlement}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmButton
                        className="btn-icon size-8 hover:text-red-600" aria-label="Remover transferência"
                        title="Excluir transferência?" message={<>A transferência de <b>{formatBRL(t.amountCents)}</b> sai do acerto do mês.</>}
                      >
                        <IconTrash width={14} height={14} />
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-auto rounded-xl border border-zinc-200/70 px-4 py-3 dark:border-zinc-800">
              <summary className="cursor-pointer list-none text-sm font-medium text-blue-600 [&::-webkit-details-marker]:hidden">
                + Registrar transferência com outro valor
              </summary>
              <div className="pt-4">
                <SettlementForm
                  month={month}
                  members={couple.members}
                  suggestedFromId={pending.debtorId ?? undefined}
                  suggestedAmount={pending.amountCents ? centsToInput(pending.amountCents) : undefined}
                />
              </div>
            </details>
          </section>
        </div>

        {/* Compras de amigos: faixa inteira logo abaixo dos cartões */}
        <section id="amigos" className="card order-6 min-w-0 scroll-mt-4 md:col-span-2 xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="card-title">Compras de amigos</h2>
              <p className="muted text-xs">O que terceiros devem em {mp.name.toLowerCase()}</p>
            </div>
            <div className="flex items-center gap-3">
              {friendTotal > 0 && (
                <div className="text-right">
                  <Money cents={friendTotal - friendPaid} size="md" />
                  <p className="muted text-[11px]">
                    {friendPaid > 0 ? `recebido ${formatBRL(friendPaid)} de ${formatBRL(friendTotal)}` : `a receber neste mês`}
                  </p>
                </div>
              )}
              <Link href={newFriendHref()} className="btn shrink-0 px-3 py-2 text-sm">+ Nova</Link>
            </div>
          </div>

          {friendGroups.length === 0 ? (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
              <p>Nenhuma compra de amigo nesta fatura.</p>
              <Link href={newFriendHref()} className="btn-outline px-3 py-1.5 text-xs">🤝 Lançar compra de um amigo</Link>
            </div>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {friendGroups.map((g) => {
                const done = g.paid >= g.amount;
                const status = done
                  ? { label: "Pago", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" }
                  : g.late
                    ? { label: "Vencido", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" }
                    : g.paid > 0
                      ? { label: "Pago em parte", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" }
                      : { label: "A receber", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
                return (
                  <li key={g.name}>
                    <Link
                      href={g.items.length === 1 ? `/receber?ver=${g.items[0].r.id}` : "/receber"}
                      className="flex h-full flex-col gap-2 rounded-xl border border-zinc-200/70 p-3 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-zinc-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {g.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                        <span className={`pill shrink-0 ${status.cls}`}>{status.label}</span>
                      </div>
                      <ul className="space-y-0.5 text-xs text-zinc-500">
                        {g.items.slice(0, 3).map(({ r, row }) => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="truncate">
                              {r.description}
                              {r.installments > 1 && <span className="text-zinc-400"> · {row.number}/{r.installments}</span>}
                            </span>
                            <span className="tabular shrink-0">{formatBRL(row.amountCents)}</span>
                          </li>
                        ))}
                        {g.items.length > 3 && <li className="text-zinc-400">+ {g.items.length - 3} compras</li>}
                      </ul>
                      <p className="mt-auto flex items-baseline justify-between border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
                        <span className="text-xs text-zinc-500">{done ? "Recebido" : "Falta"}</span>
                        <span className={`tabular font-semibold ${g.late && !done ? "text-red-600 dark:text-red-400" : ""}`}>
                          {formatBRL(done ? g.amount : g.amount - g.paid)}
                        </span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {knownFriends.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="muted">Nova compra para:</span>
              {knownFriends.map((name) => (
                <Link
                  key={name}
                  href={newFriendHref(name)}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 font-medium transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:hover:border-blue-800 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                >
                  + {name}
                </Link>
              ))}
            </div>
          )}
          {friendOpenAll > friendTotal - friendPaid && (
            <Link href="/receber" className="mt-3 inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400">
              Total em aberto com amigos (todos os meses): {formatBRL(friendOpenAll)} →
            </Link>
          )}
        </section>

        {/* ================= Coluna lateral ================= */}
        <div className="contents">
          {/* Contas a pagar */}
          <section className={`card order-2 flex min-w-0 flex-col ${payables.length > 2 ? "xl:h-0 xl:min-h-full" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="card-title">
                  Contas a pagar
                  {nextOpen && <span className="muted font-normal"> · dia {String(nextOpen.dueDay).padStart(2, "0")}</span>}
                </h2>
                <div className="mt-2"><Money cents={payTotal} size="lg" /></div>
                <p className="muted mt-0.5 text-xs">
                  {isCurrent && daysToNext !== null &&
                    (daysToNext >= 0
                      ? `próxima em ${daysToNext} dia${daysToNext === 1 ? "" : "s"} · `
                      : `${-daysToNext} dia${daysToNext === -1 ? "" : "s"} em atraso · `)}
                  <b>{paidCount} de {payables.length}</b> pagas
                </p>
              </div>
              <Illustration emoji="📅" />
            </div>

            {payables.length === 0 ? (
              empty("Nenhuma conta ou fatura neste mês.", "/contas", "Adicionar conta fixa")
            ) : (
              <>
                <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none]">
                  {days.map((d) => {
                    const items = payables.filter((p) => p.dueDay === d);
                    const allPaid = items.every((p) => p.paid);
                    return (
                      <ParamLink
                        key={d}
                        param="dia"
                        value={String(d)}
                        toggle
                        aria-label={`Contas do dia ${d}`}
                        className="group flex min-w-14 flex-1 shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition"
                        activeClassName="border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                        inactiveClassName="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <span className={`text-sm font-bold ${allPaid ? "group-data-[active=false]:text-zinc-400 group-data-[active=false]:line-through" : ""}`}>{String(d).padStart(2, "0")}</span>
                        <span className="mt-1 flex gap-0.5">
                          {items.slice(0, 5).map((p, k) => (
                            <span key={k} className={`size-1 rounded-full group-data-[active=true]:bg-white/80 ${p.paid ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                          ))}
                        </span>
                      </ParamLink>
                    );
                  })}
                </div>
                <ul className="mt-2 min-h-0 flex-1 divide-y divide-zinc-100 xl:overflow-y-auto dark:divide-zinc-800">
                  {payables.map((p) => (
                    <ParamView key={`${p.kind}-${p.refId}`} param="dia" values={["", String(p.dueDay)]}>
                      <li className="flex items-center gap-3 py-2.5">
                        <form action={togglePaid}>
                          <input type="hidden" name="kind" value={p.kind} />
                          <input type="hidden" name="refId" value={p.refId} />
                          <input type="hidden" name="month" value={month} />
                          <button
                            aria-label={p.paid ? `Desmarcar ${p.name}` : `Marcar ${p.name} como paga`}
                            className={`flex size-5 items-center justify-center rounded-full border-2 transition ${
                              p.paid ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 hover:border-blue-500 dark:border-zinc-600"
                            }`}
                          >
                            {p.paid && <IconCheck width={11} height={11} strokeWidth={3} />}
                          </button>
                        </form>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] font-medium ${p.paid ? "text-zinc-400 line-through" : ""}`}>
                            <span aria-hidden className="mr-1">{p.emoji}</span>{p.name}
                          </span>
                          <span className="muted flex items-center gap-1 text-[11px]">
                            <span className={`size-1.5 rounded-full ${MEMBER_COLORS[idx(p.payerId)].dot}`} />
                            dia {String(p.dueDay).padStart(2, "0")} · {p.payerId === me.id ? "você paga" : `${names[p.payerId]} paga`}
                          </span>
                        </span>
                        <span className={`tabular text-[13px] font-semibold ${p.paid ? "text-zinc-400" : ""}`}>{formatBRL(p.amount)}</span>
                      </li>
                    </ParamView>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Moradia */}
          <section className="card order-5 flex min-w-0 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Moradia</h2>
                <p className="muted mt-3 text-xs">Quanto você gasta pra morar</p>
                <Money cents={myHousing} size="lg" />
              </div>
              <Illustration emoji="🏡" />
            </div>
            {housingLines.length === 0 ? (
              empty("Use a categoria “Moradia” nas contas fixas (aluguel, condomínio, financiamento…).", "/contas", "Adicionar conta")
            ) : (
              <>
                {myIncome > 0 && (
                  <p className={`mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold ${myHousingPct <= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {myHousingPct <= 30 ? <IconCheck width={13} height={13} /> : <IconAlert width={13} height={13} />}
                    {fmtPct(Math.round(myHousingPct))} do seu salário
                    <span className="muted font-normal">· referência: até 30%</span>
                  </p>
                )}
                {[
                  { label: "Só meu salário", value: myHousingPct, show: myIncome > 0 },
                  { label: "Salário do casal", value: coupleHousingPct, show: coupleIncome > 0 },
                ]
                  .filter((x) => x.show)
                  .map((x) => (
                    <div key={x.label} className="mt-4">
                      <div className="flex justify-between text-[11px]">
                        <span className="muted">{x.label}</span>
                        <span className="tabular font-semibold">{fmtPct(Math.round(x.value * 10) / 10)}</span>
                      </div>
                      <div className="relative mt-1 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-full rounded-full ${x.value <= 30 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, (x.value / 60) * 100)}%` }} />
                        <span className="absolute -top-1 -bottom-1 left-1/2 w-0.5 rounded bg-zinc-900 dark:bg-white" title="30%" />
                      </div>
                    </div>
                  ))}
                <h3 className="mt-5 text-xs font-semibold">O que entra na conta (sua parte)</h3>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3">
                  {housingLines.map((l) => (
                    <li key={l.sourceId} className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm dark:bg-blue-950" aria-hidden>🏠</span>
                      <span className="min-w-0">
                        <span className="muted block truncate text-[11px]">{l.description}</span>
                        <span className="tabular block text-xs font-semibold">{formatBRL(myShare(l))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Compras do mês */}
          <CollapsibleCard
            storageKey="cc:compras-do-mes"
            label="compras do mês"
            className={`card order-8 flex min-w-0 flex-col md:col-span-2 xl:col-span-1 ${purchaseLines.length > 2 ? "xl:h-0 xl:min-h-full" : ""}`}
            collapsedClassName="card order-8 flex min-w-0 flex-col self-start md:col-span-2 xl:col-span-1"
            aside={<Illustration emoji="🧾" />}
            header={
              <>
                <h2 className="card-title">Compras do mês <span className="muted font-normal">· {purchaseLines.length}</span></h2>
                {whoFilters.map((id) => {
                  const fl = friendLines.filter((l) => !id || l.paidById === id);
                  return (
                    <ParamView key={id || "todas"} param="quem" values={[id]}>
                      <div className="mt-2"><Money cents={sum(linesOf(id).map((l) => l.amountCents))} size="lg" /></div>
                      <p className="muted mt-0.5 text-xs">{id ? `pagas por ${who(id).toLowerCase()}` : "parcelas das compras do casal"}</p>
                      {fl.length > 0 && (
                        <a href="#amigos" className="mt-1 inline-flex text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          + {formatBRL(sum(fl.map((l) => l.amountCents)))} de amigos, à parte →
                        </a>
                      )}
                    </ParamView>
                  );
                })}
              </>
            }
          >
            <div className="mt-4 grid grid-cols-3 gap-2">
              {whoFilters.map((id) => (
                <ParamLink
                  key={id || "todas"}
                  param="quem"
                  value={id}
                  className="truncate rounded-xl border px-2 py-2 text-center text-xs font-semibold transition"
                  activeClassName="border-blue-600 bg-blue-600 text-white"
                  inactiveClassName="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {id ? who(id) : "Todas"}
                </ParamLink>
              ))}
            </div>
            {whoFilters.map((id) => {
              const lines = linesOf(id);
              return (
                <ParamView key={id || "todas"} param="quem" values={[id]}>
                  {lines.length === 0 ? (
                    empty("Nenhuma parcela aqui.", "/compras/nova", "Adicionar compra")
                  ) : (
                    <ul className="mt-3 min-h-0 flex-1 divide-y divide-zinc-100 xl:overflow-y-auto dark:divide-zinc-800">
                      {lines.map((l) => {
                        const other = memberIds.find((m) => m !== l.paidById)!;
                        return (
                          <li key={l.sourceId}>
                            <Link href={`/compras/${l.sourceId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                              <Avatar name={names[l.paidById]} index={idx(l.paidById)} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-[13px] font-medium">{l.description}</span>
                                  {l.of > 1 && <span className="pill shrink-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{l.number}/{l.of}</span>}
                                  {l.recurring && <span className="pill shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">🔁 mensal</span>}
                                </span>
                                <span className="muted block truncate text-[11px]">
                                  {l.otherShareCents > 0 ? `${who(other)} deve ${formatBRL(l.otherShareCents)}` : `Só de ${who(l.paidById).toLowerCase()}`}
                                </span>
                              </span>
                              <span className="tabular text-[13px] font-semibold">{formatBRL(l.amountCents)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ParamView>
              );
            })}
          </CollapsibleCard>
        </div>
      </div>
    </>
  );
}
