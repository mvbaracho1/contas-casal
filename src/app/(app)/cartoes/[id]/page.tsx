import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCardPurchases, togglePaid } from "@/app/actions-finance";
import { ConfirmButton } from "@/components/confirm-button";
import { CreditCard } from "@/components/credit-card";
import { IconCheck, IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Avatar, Money } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { cardInsights } from "@/lib/card-insights";
import { prisma } from "@/lib/db";
import { cardOutstanding, dueDate, invoicePurchases, splitLabel } from "@/lib/finance";
import { addMonths, currentYm, formatBRL, formatYm, incomeByUser, type InstallmentLine } from "@/lib/ledger";

function monthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(y, m - 1, 1).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}/${String(y).slice(2)}`;
}
const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default async function CartaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const { couple, me, memberIds, names } = await requireCouple();
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : currentYm();

  const card = await prisma.card.findFirst({ where: { id, coupleId: couple.id } });
  if (!card) notFound();
  const [purchases, mark, incomes, receivables] = await Promise.all([
    prisma.purchase.findMany({ where: { coupleId: couple.id, cardId: card.id } }),
    prisma.paidMark.findFirst({ where: { coupleId: couple.id, cardId: card.id, month } }),
    prisma.income.findMany({ where: { coupleId: couple.id } }),
    prisma.receivable.findMany({ where: { coupleId: couple.id, purchase: { cardId: card.id } }, select: { purchaseId: true, personName: true, _count: { select: { payments: true } } } }),
  ]);
  const friendBy = new Map(receivables.map((r) => [r.purchaseId!, r.personName]));
  const ctx = { income: incomeByUser(incomes, month, memberIds), memberIds };
  const s = cardInsights(purchases, card.id, month, memberIds, new Set(friendBy.keys()), ctx);
  const used = cardOutstanding(purchases, card.id, month);
  const who = (uid: string) => (uid === me.id ? "Você" : names[uid]);
  const other = (uid: string) => memberIds.find((m) => m !== uid)!;

  const due = dueDate(month, card.dueDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToDue = Math.round((due.getTime() - today.getTime()) / 86400000);
  const status = s.lines.length === 0 ? "Sem fatura" : mark ? "Paga" : "Aberta";
  const maxBar = Math.max(...s.timeline.map((t) => t.totalCents), 1);
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));

  // Exclusão: a fatura do mês (compras com parcela nela) ou tudo do cartão
  const inv = invoicePurchases(purchases, card.id, month);
  const invParceladas = inv.remove.filter((p) => p.installments > 1).length;
  // valores "a receber" ligados: os sem recebimento saem junto; os com recebimento ficam
  const paidFriend = new Set(receivables.filter((r) => r._count.payments > 0).map((r) => r.purchaseId!));
  const friendsOf = (list: { id: string }[]) => {
    const linked = list.filter((p) => friendBy.has(p.id));
    return { gone: linked.filter((p) => !paidFriend.has(p.id)).length, kept: linked.filter((p) => paidFriend.has(p.id)).length };
  };
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const friendNote = ({ gone, kept }: { gone: number; kept: number }) =>
    (gone > 0 ? ` ${plural(gone, "valor “a receber” ligado sai", "valores “a receber” ligados saem")} junto.` : "") +
    (kept > 0 ? ` ${plural(kept, "valor com recebimento registrado continua", "valores com recebimento registrado continuam")} em “A receber”.` : "");

  const groups: { title: string; emoji: string; lines: InstallmentLine[] }[] = [
    { title: "Assinaturas", emoji: "🔁", lines: s.lines.filter((l) => l.recurring) },
    { title: "Parceladas", emoji: "🧩", lines: s.lines.filter((l) => !l.recurring && l.of > 1) },
    { title: "À vista", emoji: "🧾", lines: s.lines.filter((l) => !l.recurring && l.of === 1) },
  ].filter((g) => g.lines.length > 0);

  const compo = [
    { label: "À vista", cents: s.composition.avistaCents, color: "bg-blue-600" },
    { label: "Parcelado", cents: s.composition.parceladoCents, color: "bg-sky-400" },
    { label: "Assinaturas", cents: s.composition.assinaturaCents, color: "bg-violet-500" },
  ];
  const people = [
    ...memberIds.map((uid, i) => ({ label: who(uid), cents: s.byPerson[uid], color: i === 0 ? "bg-blue-600" : "bg-rose-500" })),
    { label: "Amigos (a receber)", cents: s.byPerson.friends, color: "bg-amber-400" },
  ];

  const Stacked = ({ items, total }: { items: { label: string; cents: number; color: string }[]; total: number }) => (
    <>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {items.map((x) => x.cents > 0 && <span key={x.label} className={x.color} style={{ width: `${(x.cents / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {items.filter((x) => x.cents > 0).map((x) => (
          <li key={x.label} className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${x.color}`} />
            <span className="flex-1">{x.label}</span>
            <span className="tabular font-semibold">{formatBRL(x.cents)}</span>
            <span className="muted tabular w-9 text-right">{pctOf(x.cents, total)}%</span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <>
      <PageHeader
        prevHref={`/cartoes/${card.id}?mes=${addMonths(month, -1)}`}
        nextHref={`/cartoes/${card.id}?mes=${addMonths(month, 1)}`}
        title={<>{card.name} <span className="font-normal text-zinc-400">· {monthShort(month)}</span></>}
        subtitle={`Fatura de ${formatYm(month).toLowerCase()} · titular ${who(card.ownerId).toLowerCase() === "você" ? "você" : names[card.ownerId]}`}
        addButton={false}
        actions={<Link href="/cartoes" className="btn-outline hidden sm:inline-flex">Todos os cartões</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {/* Resumo da fatura */}
          <section className="card">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
              <CreditCard
                name={card.name}
                owner={who(card.ownerId)}
                color={card.color}
                dueLabel={due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                limitFreeCents={card.limitCents !== null ? card.limitCents - used : null}
                status={status}
              />
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="muted text-xs">Total da fatura</p>
                  <Money cents={s.totalCents} size="xl" />
                  <p className="muted mt-1 text-xs">
                    {s.lines.length} {s.lines.length === 1 ? "lançamento" : "lançamentos"} · fecha dia {card.closingDay} · vence {due.toLocaleDateString("pt-BR")}
                    {status === "Aberta" && daysToDue >= 0 && daysToDue <= 31 && <> · <b className={daysToDue <= 3 ? "text-red-600 dark:text-red-400" : ""}>{daysToDue === 0 ? "vence hoje" : `faltam ${daysToDue} dias`}</b></>}
                    {status === "Aberta" && daysToDue < 0 && <> · <b className="text-red-600 dark:text-red-400">venceu há {-daysToDue} dias</b></>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {s.changePct !== null && (
                    <span className={`pill ${s.changePct > 0 ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                      {s.changePct > 0 ? "▲" : "▼"} {Math.abs(s.changePct).toLocaleString("pt-BR")}% vs {monthShort(addMonths(month, -1))}
                    </span>
                  )}
                  {s.avgPrevCents > 0 && <span className="pill bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">média 6 meses: {formatBRL(s.avgPrevCents)}</span>}
                </div>
                {card.limitCents !== null && (
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="muted">Limite usado</span>
                      <span className="tabular font-medium">{formatBRL(used)} de {formatBRL(card.limitCents)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className={`h-full rounded-full ${used > card.limitCents ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, (used / card.limitCents) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {s.lines.length > 0 && (
                    <form action={togglePaid}>
                      <input type="hidden" name="kind" value="card" />
                      <input type="hidden" name="refId" value={card.id} />
                      <input type="hidden" name="month" value={month} />
                      <button className={mark ? "btn-outline py-2 text-sm" : "btn bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"}>
                        <IconCheck width={14} height={14} /> {mark ? "Paga · desmarcar" : "Marcar como paga"}
                      </button>
                    </form>
                  )}
                  <Link href={`/compras/importar?cartao=${card.id}`} className="btn-outline py-2 text-sm">📄 Importar fatura</Link>
                  <Link href={`/cartoes?editar=${card.id}`} className="btn-outline py-2 text-sm">Editar</Link>
                </div>
              </div>
            </div>
          </section>

          {/* Linha do tempo */}
          <section className="card">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="card-title">Faturas mês a mês</h2>
              <span className="muted text-[11px]">toque num mês para ver</span>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {s.timeline.map((t) => {
                const cur = t.ym === month;
                const future = t.ym > month;
                return (
                  <Link key={t.ym} href={`/cartoes/${card.id}?mes=${t.ym}`} scroll={false} className="group text-center">
                    <div className={`flex h-24 items-end rounded-lg px-1 ${cur ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-950/40" : "bg-zinc-50 group-hover:bg-zinc-100 dark:bg-zinc-800/60 dark:group-hover:bg-zinc-800"}`}>
                      <div
                        className={`w-full rounded-t-md ${cur ? "bg-blue-600" : future ? "bg-blue-200 dark:bg-blue-900" : "bg-zinc-300 dark:bg-zinc-600"}`}
                        style={{ height: `${t.totalCents ? Math.max(6, (t.totalCents / maxBar) * 100) : 2}%` }}
                      />
                    </div>
                    <p className={`mt-1 text-[10px] ${cur ? "font-bold" : "font-medium"}`}>{monthShort(t.ym)}</p>
                    <p className="tabular muted text-[9px]">{t.totalCents ? formatBRL(t.totalCents).replace("R$", "").trim() : "–"}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Compras da fatura */}
          {groups.length === 0 ? (
            <section className="card text-center">
              <p className="text-3xl" aria-hidden>🧾</p>
              <p className="muted mt-2 text-sm">Nenhuma compra neste cartão em {formatYm(month).toLowerCase()}.</p>
              <Link href={`/compras/importar?cartao=${card.id}`} className="btn mt-3">Importar fatura</Link>
            </section>
          ) : (
            groups.map((g) => (
              <section key={g.title} className="card">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="card-title">{g.emoji} {g.title} <span className="font-normal text-zinc-400">· {g.lines.length}</span></h2>
                  <span className="tabular text-sm font-semibold">{formatBRL(g.lines.reduce((a, l) => a + l.amountCents, 0))}</span>
                </div>
                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {g.lines.map((l) => {
                    const p = purchaseById.get(l.sourceId)!;
                    const friend = friendBy.get(l.sourceId);
                    return (
                      <li key={l.sourceId}>
                        <Link href={`/compras/${l.sourceId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                          <Avatar name={names[l.paidById]} index={memberIds.indexOf(l.paidById)} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium">{l.description}</span>
                              {l.of > 1 && <span className="pill shrink-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{l.number}/{l.of}</span>}
                            </span>
                            <span className="muted block truncate text-[11px]">
                              {p.purchaseDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} ·{" "}
                              {friend ? `🤝 De ${friend} · a receber` : p.payerSharePct === null ? "Pela renda" : splitLabel(p.payerSharePct, who(l.paidById), who(other(l.paidById))).replace("de Você", "de você")}
                            </span>
                          </span>
                          <span className="tabular text-[13px] font-semibold">{formatBRL(l.amountCents)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Insights */}
        <aside className="space-y-4">
          {s.totalCents > 0 && (
            <>
              <section className="card">
                <h2 className="card-title">Do que é feita a fatura</h2>
                <Stacked items={compo} total={s.totalCents} />
              </section>
              <section className="card">
                <h2 className="card-title">De quem é a fatura</h2>
                <p className="muted text-xs">Quanto cabe a cada um, pela divisão das compras</p>
                <Stacked items={people} total={s.totalCents} />
              </section>
            </>
          )}

          <section className="card">
            <h2 className="card-title">🧩 Parcelamentos em aberto</h2>
            {s.openInstallments.length === 0 ? (
              <p className="muted mt-2 text-sm">Nenhuma parcela para os próximos meses. 🎉</p>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  <b className="tabular">{formatBRL(s.committedCents)}</b> <span className="muted">já comprometidos nas próximas faturas</span>
                </p>
                {s.nextRelief && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                    💚 Em <b>{formatYm(s.nextRelief.ym).toLowerCase()}</b> a fatura fica <b>{formatBRL(s.nextRelief.cents)}</b> mais leve: acaba{" "}
                    {s.nextRelief.descriptions.length === 1 ? s.nextRelief.descriptions[0] : `${s.nextRelief.descriptions.length} parcelamentos`}.
                  </p>
                )}
                <ul className="mt-2 divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                  {s.openInstallments.slice(0, 6).map((x) => (
                    <li key={x.id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{x.description}</span>
                        <span className="muted">faltam {x.remainingCount}x de {formatBRL(x.perInstallmentCents)} · até {monthShort(x.lastMonth)}</span>
                      </span>
                      <span className="tabular font-semibold">{formatBRL(x.remainingCents)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {s.subscriptions.length > 0 && (
            <section className="card">
              <h2 className="card-title">🔁 Assinaturas</h2>
              <p className="mt-2 text-sm">
                <b className="tabular">{formatBRL(s.subscriptionsMonthlyCents)}</b>/mês <span className="muted">· {formatBRL(s.subscriptionsMonthlyCents * 12)} por ano</span>
              </p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {s.subscriptions.map((x) => (
                  <li key={x.id} className="flex justify-between gap-2">
                    <Link href={`/compras/${x.id}`} className="truncate hover:underline">{x.description}</Link>
                    <span className="tabular font-semibold">{formatBRL(x.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.topPurchases.length > 0 && (
            <section className="card">
              <h2 className="card-title">🏆 Maiores do mês</h2>
              <ol className="mt-2 space-y-2 text-xs">
                {s.topPurchases.map((l, i) => (
                  <li key={l.sourceId} className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold dark:bg-zinc-800">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{l.description}{l.of > 1 && <span className="muted"> · {l.number}/{l.of}</span>}</span>
                    <span className="tabular font-semibold">{formatBRL(l.amountCents)}</span>
                    <span className="muted tabular w-8 text-right">{pctOf(l.amountCents, s.totalCents)}%</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {purchases.length > 0 && (
            <section className="card space-y-3">
              <div>
                <h2 className="card-title">Excluir</h2>
                <p className="muted text-xs">Para refazer uma importação ou começar o cartão do zero. O cartão continua.</p>
              </div>
              {inv.remove.length > 0 && (
                <form action={deleteCardPurchases}>
                  <input type="hidden" name="cardId" value={card.id} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="scope" value="fatura" />
                  <ConfirmButton
                    className="btn-outline w-full justify-center py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    title={`Excluir a fatura de ${formatYm(month).toLowerCase()}?`}
                    confirmLabel="Excluir fatura"
                    message={
                      <>
                        <b>{plural(inv.remove.length, "compra", "compras")}</b> desta fatura {inv.remove.length === 1 ? "será apagada" : "serão apagadas"}.
                        {invParceladas > 0 && ` As parceladas saem inteiras, com as parcelas dos outros meses.`}
                        {inv.keptSubscriptions.length > 0 && ` ${plural(inv.keptSubscriptions.length, "assinatura antiga continua", "assinaturas antigas continuam")} (${inv.keptSubscriptions.map((p) => p.description).join(", ")}).`}
                        {friendNote(friendsOf(inv.remove))}
                      </>
                    }
                  >
                    <IconTrash width={14} height={14} /> Excluir esta fatura · {plural(inv.remove.length, "compra", "compras")}
                  </ConfirmButton>
                </form>
              )}
              <form action={deleteCardPurchases}>
                <input type="hidden" name="cardId" value={card.id} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="scope" value="tudo" />
                <ConfirmButton
                  className="btn-danger w-full justify-center"
                  title={`Excluir todas as compras do ${card.name}?`}
                  confirmLabel="Excluir tudo"
                  requireText="APAGAR"
                  message={
                    <>
                      <b>{plural(purchases.length, "compra", "compras")}</b> do cartão, de todos os meses, {purchases.length === 1 ? "será apagada" : "serão apagadas"}, junto com as marcações de fatura paga. O cartão continua cadastrado.
                      {friendNote(friendsOf(purchases))} Não dá para desfazer.
                    </>
                  }
                >
                  <IconTrash width={14} height={14} /> Excluir todas as compras do cartão
                </ConfirmButton>
              </form>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
