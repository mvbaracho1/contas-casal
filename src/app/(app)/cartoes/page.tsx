import Link from "next/link";
import { deleteCard } from "@/app/actions-finance";
import { CreditCard } from "@/components/credit-card";
import { CardForm } from "@/components/finance-forms";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInvoice, cardOutstanding } from "@/lib/finance";
import { addMonths, currentYm, formatBRL } from "@/lib/ledger";
import { ConfirmButton } from "@/components/confirm-button";
import { ParamClass, ParamLink, ParamView } from "@/components/url-state";

function monthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(y, m - 1, 1).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}/${String(y).slice(2)}`;
}

// ?editar=ID troca no navegador (url-state): os formulários de edição já vêm prontos do servidor.
export default async function CartoesPage() {
  const { couple, me, names } = await requireCouple();
  const [cards, purchases, marks] = await Promise.all([
    prisma.card.findMany({ where: { coupleId: couple.id }, orderBy: { createdAt: "asc" } }),
    prisma.purchase.findMany({ where: { coupleId: couple.id, cardId: { not: null } } }),
    prisma.paidMark.findMany({ where: { coupleId: couple.id, cardId: { not: null } } }),
  ]);
  const month = currentYm();

  return (
    <>
      <PageHeader title="Cartões" subtitle="Faturas calculadas pelas compras de cada cartão" addButton={false} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {cards.length === 0 && (
            <div className="card text-center">
              <p className="text-4xl">💳</p>
              <p className="muted mt-2 text-sm">Cadastre os cartões para ver as faturas e escolher o cartão em cada compra.</p>
            </div>
          )}
          {cards.map((c) => {
            const inv = cardInvoice(purchases, c.id, month);
            const paid = marks.some((m) => m.cardId === c.id && m.month === month);
            const used = cardOutstanding(purchases, c.id, month);
            const next = [0, 1, 2, 3].map((n) => ({ ym: addMonths(month, n), ...cardInvoice(purchases, c.id, addMonths(month, n)) }));
            const max = Math.max(...next.map((x) => x.totalCents), 1);
            return (
              <section key={c.id} className="card group relative transition hover:border-blue-300 hover:shadow-md dark:hover:border-blue-800">
                {/* O card todo abre os detalhes; botões e links internos ficam por cima (relative z-10). */}
                <Link href={`/cartoes/${c.id}`} aria-label={`Ver detalhes do ${c.name}`} className="absolute inset-0 z-0 rounded-2xl" />
                <div className="pointer-events-none relative grid gap-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="rounded-2xl transition group-hover:-translate-y-0.5">
                    <CreditCard
                      name={c.name}
                      owner={c.ownerId === me.id ? "Você" : names[c.ownerId]}
                      color={c.color}
                      dueLabel={`dia ${String(c.dueDay).padStart(2, "0")}`}
                      limitFreeCents={c.limitCents !== null ? c.limitCents - used : null}
                      status={inv.count === 0 ? "Sem fatura" : paid ? "Paga" : "Aberta"}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="muted text-xs">Fatura deste mês</p>
                        <p className="tabular text-2xl font-bold tracking-tight">{formatBRL(inv.totalCents)}</p>
                        <p className="muted text-xs">
                          {inv.count} parcela{inv.count === 1 ? "" : "s"} · fecha dia {c.closingDay} · vence dia {c.dueDay}
                        </p>
                        <Link href={`/cartoes/${c.id}`} className="pointer-events-auto mt-1 inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Ver compras e detalhes →
                        </Link>
                      </div>
                      <div className="pointer-events-auto flex shrink-0 gap-1">
                        <Link href={`/compras/importar?cartao=${c.id}`} className="btn-outline">📄 Importar<span className="hidden sm:inline"> fatura</span></Link>
                        <ParamLink param="editar" value={c.id} push scrollTo="painel" className="btn-outline">Editar</ParamLink>
                        <form action={deleteCard}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton
                            className="btn-icon size-8 hover:text-red-600" aria-label="Excluir cartão"
                            title="Excluir cartão?" message={<>O cartão <b>{c.name}</b> será apagado. As compras continuam, mas ficam sem cartão.</>}
                          >
                            <IconTrash width={14} height={14} />
                          </ConfirmButton>
                        </form>
                      </div>
                    </div>
                    {c.limitCents !== null && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[11px]">
                          <span className="muted">Limite usado</span>
                          <span className="tabular font-medium">{formatBRL(used)} de {formatBRL(c.limitCents)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className={`h-full rounded-full ${used > c.limitCents ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, (used / c.limitCents) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <p className="mt-4 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Próximas faturas</p>
                    <div className="mt-2 grid grid-cols-4 items-end gap-2">
                      {next.map((x, i) => (
                        <div key={x.ym} className="text-center">
                          <div className="flex h-14 items-end justify-center rounded-lg bg-zinc-50 px-2 dark:bg-zinc-800/60">
                            <div className={`w-full rounded-t-md ${i === 0 ? "bg-blue-600" : "bg-blue-200 dark:bg-blue-900"}`} style={{ height: `${Math.max(4, (x.totalCents / max) * 100)}%` }} />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold">{monthShort(x.ym)}</p>
                          <p className="tabular muted text-[10px]">{formatBRL(x.totalCents)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <ParamClass not param="editar" values={[""]} activeClassName="order-first lg:order-none">
          <div id="painel" className="scroll-mt-20" />
          {cards.map((editing) => (
            <ParamView key={editing.id} param="editar" values={[editing.id]}>
              <CardForm
                key={editing.id}
                members={couple.members}
                defaults={{ id: editing.id, name: editing.name, ownerId: editing.ownerId, closingDay: editing.closingDay, dueDay: editing.dueDay, limitCents: editing.limitCents, color: editing.color }}
              />
            </ParamView>
          ))}
          <ParamView param="editar" values={[""]}>
            <CardForm key="new"
                members={couple.members} defaults={{ ownerId: me.id }} />
          </ParamView>
        </ParamClass>
      </div>
    </>
  );
}
