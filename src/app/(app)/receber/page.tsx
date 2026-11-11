import Link from "next/link";
import { deleteReceivable, deleteReceivablePayment } from "@/app/actions-receivables";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ChargeButtons, PaymentForm, ReceivableForm } from "@/components/receivable-forms";
import { Avatar, Money, pct } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentYm, formatBRL, formatYm } from "@/lib/ledger";
import { chargeMessage, summarizeReceivable, whatsappLink, type InstallmentStatus, type ReceivableSummary } from "@/lib/receivables";
import { ConfirmButton } from "@/components/confirm-button";
import { ParamClass, ParamLink, ParamView } from "@/components/url-state";

export const metadata = { title: "A receber · Contas do Casal" };

const STATUS: Record<ReceivableSummary["status"], { label: string; cls: string }> = {
  atrasado: { label: "Atrasado", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "em-dia": { label: "Em dia", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  quitado: { label: "Quitado", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};
const ROW: Record<InstallmentStatus, { label: string; cls: string }> = {
  pago: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  parcial: { label: "Pago em parte", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  vencido: { label: "Vencido", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "este-mes": { label: "Vence este mês", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "a-vencer": { label: "A vencer", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
};

// ?filtro=todos, ?ver=ID e ?editar=ID trocam no navegador (url-state): tudo já vem pronto do servidor.
export default async function ReceberPage() {
  const { couple, me, memberIds, names } = await requireCouple();
  const today = currentYm();

  const list = await prisma.receivable.findMany({
    where: { coupleId: couple.id },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      purchase: { select: { id: true, card: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const items = list.map((r) => ({ r, s: summarizeReceivable(r, r.payments, today) }));
  const open = items.filter((x) => x.s.status !== "quitado");

  const totalOpen = open.reduce((a, x) => a + x.s.remainingCents, 0);
  const totalOverdue = open.reduce((a, x) => a + x.s.overdueCents, 0);
  const totalThisMonth = open.reduce((a, x) => a + x.s.dueNowCents - x.s.overdueCents, 0);
  const byCreditor = memberIds.map((id) => ({ id, cents: open.filter((x) => x.r.creditorId === id).reduce((a, x) => a + x.s.remainingCents, 0) }));

  // agrupa por pessoa (ignorando maiúsculas e espaços)
  const groupBy = (visible: typeof items) => {
    const groups = new Map<string, { name: string; items: typeof items }>();
    for (const x of visible) {
      const key = x.r.personName.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, { name: x.r.personName.trim(), items: [] });
      groups.get(key)!.items.push(x);
    }
    return groups;
  };
  const people = [...new Set(list.map((r) => r.personName.trim()))].sort();

  const seg = "rounded-lg px-3 py-1.5 text-xs font-semibold transition";
  const segOn = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white";
  const segOff = "text-zinc-500 hover:text-zinc-900 dark:hover:text-white";
  // "+ Novo" aparece quando há algo aberto no painel (detalhe ou edição)
  const newLink = (cls: string) => (
    <ParamView not when={{ ver: [""], editar: [""] }}>
      <ParamLink param="ver" value="" clear={["editar"]} className={cls}>+ Novo</ParamLink>
    </ParamView>
  );

  return (
    <>
      <PageHeader
        title="A receber"
        subtitle="Compras de amigos e outros valores que te devem"
        addButton={false}
        actions={newLink("btn hidden sm:inline-flex")}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Total a receber</h2>
                <div className="mt-2"><Money cents={totalOpen} size="lg" /></div>
                <p className="muted text-xs">
                  {byCreditor.filter((c) => c.cents > 0).map((c) => `${c.id === me.id ? "você" : names[c.id]} recebe ${formatBRL(c.cents)}`).join(" · ") || "Nada em aberto"}
                </p>
              </div>
              <span className="text-4xl sm:text-5xl" aria-hidden>🤝</span>
            </div>
            {(totalOverdue > 0 || totalThisMonth > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-red-950/50">
                  <p className="text-[11px] text-red-700 dark:text-red-300">Vencido</p>
                  <p className="tabular font-semibold text-red-700 dark:text-red-300">{formatBRL(totalOverdue)}</p>
                </div>
                <div className="rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-950/50">
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">Vence em {formatYm(today).toLowerCase()}</p>
                  <p className="tabular font-semibold text-blue-700 dark:text-blue-300">{formatBRL(totalThisMonth)}</p>
                </div>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <ParamLink param="filtro" value="" className={seg} activeClassName={segOn} inactiveClassName={segOff}>Em aberto · {open.length}</ParamLink>
              <ParamLink param="filtro" value="todos" className={seg} activeClassName={segOn} inactiveClassName={segOff}>Todos · {items.length}</ParamLink>
            </div>
            {newLink("btn sm:hidden")}
          </div>

          {[
            { key: "", groups: groupBy(open) },
            { key: "todos", groups: groupBy(items) },
          ].map(({ key, groups }) => (
            <ParamView key={key || "abertos"} param="filtro" values={[key]}>
              <div className="space-y-4">
              {groups.size === 0 && (
                <div className="card text-center">
                  <p className="muted text-sm">
                    {items.length ? "Ninguém te deve nada agora. 🎉" : "Nenhum valor a receber ainda. Cadastre aqui, ou marque “De um amigo” ao lançar ou importar uma compra."}
                  </p>
                </div>
              )}

              {[...groups.values()].map((g) => {
                const owed = g.items.reduce((a, x) => a + x.s.remainingCents, 0);
                const late = g.items.some((x) => x.s.status === "atrasado");
                return (
                  <section key={g.name} className="card">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="card-title truncate">{g.name}</h2>
                        <p className="muted text-xs">{g.items.length} {g.items.length === 1 ? "registro" : "registros"}{late && " · tem valor vencido"}</p>
                      </div>
                      <p className={`tabular text-sm font-semibold ${late ? "text-red-600 dark:text-red-400" : ""}`}>{formatBRL(owed)}</p>
                    </div>
                    <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {g.items.map(({ r, s }) => (
                        <li key={r.id}>
                          <ParamLink
                            param="ver" value={r.id} push scrollTo="painel" clear={["editar"]}
                            className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                            activeClassName="bg-zinc-50 dark:bg-zinc-800/60"
                          >
                            <Avatar name={names[r.creditorId]} index={memberIds.indexOf(r.creditorId)} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{r.description}</span>
                                <span className={`pill shrink-0 ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct(s.paidCents, s.owedCents)}%` }} />
                                </span>
                                <span className="shrink-0 text-[11px] text-zinc-400">
                                  {r.installments > 1 ? `${s.rows.filter((x) => x.status === "pago").length}/${s.rows.length} parcelas` : s.status === "quitado" ? "recebido" : formatYm(r.firstMonth)}
                                  {r.purchase?.card && ` · ${r.purchase.card.name}`}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="tabular text-sm font-semibold">{formatBRL(s.remainingCents)}</p>
                              <p className="tabular text-[11px] text-zinc-500">de {formatBRL(s.owedCents)}</p>
                            </div>
                          </ParamLink>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              </div>
            </ParamView>
          ))}
        </div>

        <ParamClass not when={{ ver: [""], editar: [""] }} className="space-y-4 scroll-mt-4" activeClassName="order-first lg:order-none">
          <div id="painel" className="scroll-mt-20" />
          {items.map((item) => (
            <ParamView key={item.r.id} param="ver" values={[item.r.id]}>
              <Detail item={item} names={names} />
            </ParamView>
          ))}
          {list.map((editing) => (
            <ParamView key={editing.id} when={{ ver: [""], editar: [editing.id] }}>
              <ReceivableForm
                key={editing.id}
                members={couple.members}
                people={people}
                defaults={{
                  id: editing.id, personName: editing.personName, description: editing.description, totalCents: editing.totalCents,
                  installments: editing.installments, firstMonth: editing.firstMonth, creditorId: editing.creditorId, note: editing.note,
                  linkedPurchaseId: editing.purchaseId,
                }}
              />
            </ParamView>
          ))}
          <ParamView when={{ ver: [""], editar: [""] }}>
            <ReceivableForm key="new" members={couple.members} people={people} defaults={{ firstMonth: today, creditorId: me.id }} />
          </ParamView>
        </ParamClass>
      </div>
    </>
  );
}

type Item = {
  r: Awaited<ReturnType<typeof prisma.receivable.findMany<{ include: { payments: true; purchase: { select: { id: true; card: { select: { name: true } } } } } }>>>[number];
  s: ReceivableSummary;
};

function Detail({ item: { r, s }, names }: { item: Item; names: Record<string, string> }) {
  const msg = chargeMessage(r, s);
  const suggested = s.dueNowCents > 0 ? s.dueNowCents : s.next ? s.next.amountCents - s.next.paidCents : 0;
  return (
    <section className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="muted text-xs">{r.personName} deve a {names[r.creditorId]}</p>
          <h2 className="truncate text-base font-semibold">{r.description}</h2>
          {r.purchase && (
            <Link href={`/compras/${r.purchase.id}`} className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {r.purchase.card ? `Compra no cartão ${r.purchase.card.name}` : "Ver a compra"} →
            </Link>
          )}
        </div>
        <ParamLink param="ver" value="" className="btn-icon" aria-label="Fechar">✕</ParamLink>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="muted text-xs">{s.status === "quitado" ? "Tudo recebido" : "Falta receber"}</p>
            <Money cents={s.remainingCents} size="lg" />
          </div>
          <span className={`pill ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
        </div>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct(s.paidCents, s.owedCents)}%` }} />
        </span>
        <p className="muted mt-1 text-[11px]">Recebido {formatBRL(s.paidCents)} de {formatBRL(s.owedCents)}</p>
        {r.note && <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{r.note}</p>}
      </div>

      {r.installments > 1 && (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {s.rows.map((x) => (
            <li key={x.number} className="flex items-center gap-2 py-2">
              <span className="w-12 text-xs text-zinc-500">{x.number}/{r.installments}</span>
              <span className="flex-1 text-xs">{formatYm(x.month)}</span>
              <span className={`pill ${ROW[x.status].cls}`}>{ROW[x.status].label}</span>
              <span className="tabular w-20 text-right text-xs font-semibold">{formatBRL(x.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {s.status !== "quitado" && (
        <>
          <div className="space-y-2 rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="text-xs font-semibold">Cobrar</p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 font-sans text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{msg}</pre>
            <ChargeButtons message={msg} whatsapp={whatsappLink(msg)} />
          </div>
          <div className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
            <PaymentForm key={r.id} receivableId={r.id} suggestedCents={suggested} />
          </div>
        </>
      )}

      {r.payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold">Recebimentos</p>
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {r.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1 text-xs text-zinc-500">{p.paidAt.toISOString().slice(0, 10).split("-").reverse().join("/")}</span>
                <span className="tabular text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatBRL(p.amountCents)}</span>
                <form action={deleteReceivablePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton
                    className="btn-icon size-7 hover:text-red-600" aria-label="Excluir recebimento"
                    title="Excluir recebimento?" message={<>O recebimento de <b>{formatBRL(p.amountCents)}</b> volta a ficar em aberto.</>}
                  >
                    <IconTrash width={13} height={13} />
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <ParamLink param="editar" value={r.id} push scrollTo="painel" clear={["ver"]} className="btn-outline py-2 text-sm">Editar</ParamLink>
        <form action={deleteReceivable}>
          <input type="hidden" name="id" value={r.id} />
          <ConfirmButton
            className="btn-danger" title="Excluir valor a receber?"
            message={<><b>{r.description}</b> ({r.personName}) e os recebimentos registrados serão apagados.{r.purchase && " A compra continua."}</>}
          >
            <IconTrash /> Excluir
          </ConfirmButton>
        </form>
      </div>
    </section>
  );
}
