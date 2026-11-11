import Link from "next/link";
import { deleteSettlement } from "@/app/actions";
import { togglePaid } from "@/app/actions-finance";
import { CreditCard } from "@/components/credit-card";
import { IconAlert, IconArrowRight, IconArrowUpRight, IconCheck, IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuickSettle } from "@/components/quick-settle";
import { SettlementForm } from "@/components/settlement-form";
import { Avatar, fmtPct, Illustration, MEMBER_COLORS, Money, pct } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { BILL_EMOJI, cardInvoice, cardOutstanding, dueDate, splitLabel } from "@/lib/finance";
import { loadCoupleData } from "@/lib/finance-data";
import { addMonths, currentYm, formatBRL, incomeByUser, summarizeMonth, type InstallmentLine } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { summarizeReceivable } from "@/lib/receivables";

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
  searchParams: Promise<{ mes?: string; quem?: string; dia?: string; cartao?: string }>;
}) {
  const { couple, me, partner, memberIds, names } = await requireCouple();
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentYm();
  const idx = (id: string) => memberIds.indexOf(id);
  const who = (id: string) => (id === me.id ? "Você" : names[id]);
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    p.set("mes", month);
    for (const k of ["quem", "dia", "cartao"] as const) if (sp[k] && !(k in extra)) p.set(k, sp[k]!);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return `/?${p}`;
  };

  const [{ purchases, settlements, incomes, cards, bills, paidMarks }, receivables] = await Promise.all([
    loadCoupleData(couple.id),
    prisma.receivable.findMany({ where: { coupleId: couple.id }, include: { payments: { select: { amountCents: true } } } }),
  ]);
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
  const friendOpenAll = receivables.reduce((a, r) => a + summarizeReceivable(r, r.payments, currentYm()).remainingCents, 0);
  const s = summarizeMonth(purchases, settlements, month, memberIds, { bills, incomes });
  const monthSettlements = settlements.filter((x) => x.month === month);
  const pending = s.monthPending;
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
  const dayFilter = sp.dia && days.includes(Number(sp.dia)) ? Number(sp.dia) : undefined;
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
  const selCard = cards.find((c) => c.id === sp.cartao) ?? cards[0];
  const selInvoices = selCard
    ? [0, 1, 2].map((n) => ({ ym: addMonths(month, n), ...cardInvoice(purchases, selCard.id, addMonths(month, n)) }))
    : [];
  const maxInv = Math.max(...selInvoices.map((x) => x.totalCents), 1);

  // ---------- Moradia ----------
  const housingLines = billLines.filter((l) => bills.find((b) => b.id === l.sourceId)?.category === "Moradia");
  const myHousing = sum(housingLines.map(myShare));
  const coupleHousing = sum(housingLines.map((l) => l.amountCents));
  const myHousingPct = myIncome ? (myHousing / myIncome) * 100 : 0;
  const coupleHousingPct = coupleIncome ? (coupleHousing / coupleIncome) * 100 : 0;

  // ---------- Compras do mês ----------
  const filterId = sp.quem && memberIds.includes(sp.quem) ? sp.quem : undefined;
  const lines = purchaseLines.filter((l) => !filterId || l.paidById === filterId).sort((a, b) => b.amountCents - a.amountCents);

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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="card-title">Cartões</h2>
                  <p className="muted mt-3 truncate text-xs">Fatura de {mp.name.toLowerCase()}{selCard && ` · ${selCard.name}`}</p>
                  <Money cents={selInvoices[0]?.totalCents ?? 0} size="lg" />
                </div>
                <Illustration emoji="💳" />
              </div>
              {cards.length === 0 ? (
                empty("Cadastre os cartões para acompanhar faturas e limites.", "/cartoes", "Adicionar cartão")
              ) : (
                <>
                  <Link href="/cartoes" className="btn-outline mt-3 self-start">Ver faturas</Link>
                  <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1 sm:-mx-5 sm:px-5 [scrollbar-width:none]">
                    {cardInvoices.map((ci) => {
                      const sel = ci.card.id === selCard?.id;
                      const paid = paidMarks.some((m) => m.cardId === ci.card.id && m.month === month);
                      return (
                        <Link
                          key={ci.card.id}
                          href={q({ cartao: ci.card.id })}
                          scroll={false}
                          className={`w-[78%] max-w-72 shrink-0 snap-start rounded-2xl transition ${sel ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900" : "opacity-75 hover:opacity-100"}`}
                        >
                          <CreditCard
                            name={ci.card.name}
                            owner={who(ci.card.ownerId)}
                            color={ci.card.color}
                            dueLabel={`${String(ci.card.dueDay).padStart(2, "0")}/${String(mp.m).padStart(2, "0")}`}
                            limitFreeCents={ci.card.limitCents !== null ? ci.card.limitCents - cardOutstanding(purchases, ci.card.id, month) : null}
                            status={ci.count === 0 ? "Sem fatura" : paid ? "Paga" : "Aberta"}
                          />
                        </Link>
                      );
                    })}
                  </div>

                  <p className="mt-5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Próximas faturas</p>
                  <div className="relative mt-2 grid flex-1 grid-cols-3 gap-2">
                    {selInvoices.map((u, i) => {
                      const p = monthParts(u.ym);
                      const top = 75 - (u.totalCents / maxInv) * 28; // fica abaixo do selo "Atual"
                      return (
                        <Link
                          key={u.ym}
                          href={`/?mes=${u.ym}${selCard ? `&cartao=${selCard.id}` : ""}`}
                          className={`relative flex min-h-32 flex-col items-center overflow-hidden rounded-xl border p-2 pt-3 text-center transition ${
                            i === 0 ? "border-blue-500 bg-white ring-2 ring-blue-500/15 dark:bg-zinc-900" : "border-transparent bg-zinc-50 hover:border-zinc-200 dark:bg-zinc-800/60 dark:hover:border-zinc-700"
                          }`}
                        >
                          <span className="text-xs font-semibold capitalize">{p.short} {String(p.year).slice(2)}</span>
                          {i === 0 && <span className="pill mt-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Atual</span>}
                          {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-blue-100 to-blue-50/40 dark:from-blue-950 dark:to-transparent" style={{ top: `${top}%` }} />}
                          <span className="absolute left-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-white dark:bg-zinc-900" style={{ top: `${top}%` }} />
                          <span className={`tabular relative mt-auto text-xs font-semibold sm:text-[13px] ${i === 0 ? "text-blue-700 dark:text-blue-300" : "text-zinc-600 dark:text-zinc-300"}`}>
                            {formatBRL(u.totalCents)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Acerto do mês */}
          <section id="acerto" className={`card order-7 flex min-w-0 flex-col gap-4 md:col-span-2 ${lines.length > 2 ? "xl:min-h-[28rem]" : ""}`}>
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
                      <button className="btn-icon size-8 hover:text-red-600" aria-label="Remover transferência"><IconTrash width={14} height={14} /></button>
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
              <p className="muted text-xs">O que terceiros devem na fatura de {mp.name.toLowerCase()}</p>
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
              <span className="text-3xl" aria-hidden>🤝</span>
            </div>
          </div>

          {friendGroups.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Nenhuma compra de amigo nesta fatura. Ao lançar ou importar uma compra, escolha <b>“De um amigo”</b>.
            </p>
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
                    const active = dayFilter === d;
                    const items = payables.filter((p) => p.dueDay === d);
                    const allPaid = items.every((p) => p.paid);
                    return (
                      <Link
                        key={d}
                        href={q({ dia: active ? undefined : String(d) })}
                        scroll={false}
                        className={`flex min-w-14 flex-1 shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition ${
                          active ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/30" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className={`text-sm font-bold ${allPaid && !active ? "text-zinc-400 line-through" : ""}`}>{String(d).padStart(2, "0")}</span>
                        <span className="mt-1 flex gap-0.5">
                          {items.slice(0, 5).map((p, k) => (
                            <span key={k} className={`size-1 rounded-full ${active ? "bg-white/80" : p.paid ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                          ))}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <ul className="mt-2 min-h-0 flex-1 divide-y divide-zinc-100 xl:overflow-y-auto dark:divide-zinc-800">
                  {payables
                    .filter((p) => !dayFilter || p.dueDay === dayFilter)
                    .map((p) => (
                      <li key={`${p.kind}-${p.refId}`} className="flex items-center gap-3 py-2.5">
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
          <section className={`card order-8 flex min-w-0 flex-col md:col-span-2 xl:col-span-1 ${lines.length > 2 ? "xl:h-0 xl:min-h-full" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Compras do mês <span className="muted font-normal">· {purchaseLines.length}</span></h2>
                <div className="mt-2"><Money cents={sum(lines.map((l) => l.amountCents))} size="lg" /></div>
                <p className="muted mt-0.5 text-xs">{filterId ? `pagas por ${who(filterId).toLowerCase()}` : "parcelas das compras do casal"}</p>
                {(() => {
                  const fl = friendLines.filter((l) => !filterId || l.paidById === filterId);
                  return fl.length > 0 ? (
                    <a href="#amigos" className="mt-1 inline-flex text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      + {formatBRL(sum(fl.map((l) => l.amountCents)))} de amigos, à parte →
                    </a>
                  ) : null;
                })()}
              </div>
              <Illustration emoji="🧾" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[undefined, ...memberIds].map((id) => {
                const active = filterId === id;
                return (
                  <Link
                    key={id ?? "todas"}
                    href={q({ quem: id })}
                    scroll={false}
                    className={`truncate rounded-xl border px-2 py-2 text-center text-xs font-semibold transition ${
                      active ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {id ? who(id) : "Todas"}
                  </Link>
                );
              })}
            </div>
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
          </section>
        </div>
      </div>
    </>
  );
}
