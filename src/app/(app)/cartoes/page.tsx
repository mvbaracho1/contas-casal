import Link from "next/link";
import { deleteCard } from "@/app/actions-finance";
import { CardsBrowser } from "@/components/cards-browser";
import { ConfirmButton } from "@/components/confirm-button";
import { CreditCard } from "@/components/credit-card";
import { IconPlus, IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInvoice, cardOutstanding } from "@/lib/finance";
import { addMonths, currentYm, formatBRL } from "@/lib/ledger";

function monthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(y, m - 1, 1).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}/${String(y).slice(2)}`;
}

// Lista em carrossel (um cartão por vez). Cadastro em /cartoes/novo e edição em /cartoes/[id]/editar.
export default async function CartoesPage() {
  const { couple, me, names } = await requireCouple();
  const [cards, purchases, marks] = await Promise.all([
    prisma.card.findMany({ where: { coupleId: couple.id }, orderBy: { createdAt: "asc" } }),
    prisma.purchase.findMany({ where: { coupleId: couple.id, cardId: { not: null } } }),
    prisma.paidMark.findMany({ where: { coupleId: couple.id, cardId: { not: null } } }),
  ]);
  const month = currentYm();
  const addButton = (
    <Link href="/cartoes/novo" className="btn" aria-label="Novo cartão">
      <IconPlus /> <span className="hidden sm:inline">Novo cartão</span>
    </Link>
  );

  return (
    <>
      <PageHeader title="Cartões" subtitle="Faturas calculadas pelas compras de cada cartão" addButton={false} actions={addButton} />

      {cards.length === 0 ? (
        <div className="card mx-auto max-w-md text-center">
          <p className="text-4xl">💳</p>
          <p className="muted mt-2 text-sm">Cadastre os cartões para ver as faturas e escolher o cartão em cada compra.</p>
        </div>
      ) : (
        <CardsBrowser
          cards={cards.map((c) => {
            const inv = cardInvoice(purchases, c.id, month);
            const paid = marks.some((m) => m.cardId === c.id && m.month === month);
            const used = cardOutstanding(purchases, c.id, month);
            const next = [0, 1, 2, 3].map((n) => ({ ym: addMonths(month, n), ...cardInvoice(purchases, c.id, addMonths(month, n)) }));
            const max = Math.max(...next.map((x) => x.totalCents), 1);
            const n = purchases.filter((x) => x.cardId === c.id).length;
            return {
              id: c.id,
              name: c.name,
              detailHref: `/cartoes/${c.id}`,
              node: (
                <CreditCard
                  name={c.name}
                  owner={c.ownerId === me.id ? "Você" : names[c.ownerId]}
                  color={c.color}
                  dueLabel={`dia ${String(c.dueDay).padStart(2, "0")}`}
                  limitFreeCents={c.limitCents !== null ? c.limitCents - used : null}
                  status={inv.count === 0 ? "Sem fatura" : paid ? "Paga" : "Aberta"}
                />
              ),
              details: (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="min-w-0">
                    <p className="muted text-xs">Fatura deste mês · {c.name}</p>
                    <p className="tabular text-2xl font-bold tracking-tight">{formatBRL(inv.totalCents)}</p>
                    <p className="muted text-xs">
                      {inv.count} parcela{inv.count === 1 ? "" : "s"} · fecha dia {c.closingDay} · vence dia {c.dueDay}
                    </p>
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/cartoes/${c.id}`} className="btn py-2 text-sm">Ver compras e detalhes</Link>
                      <Link href={`/compras/importar?cartao=${c.id}`} className="btn-outline py-2 text-sm">📄 Importar fatura</Link>
                      <Link href={`/cartoes/${c.id}/editar`} className="btn-outline py-2 text-sm">Editar</Link>
                      <form action={deleteCard}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          className="btn-icon size-9 hover:text-red-600" aria-label="Excluir cartão"
                          title="Excluir cartão?"
                          message={
                            n === 0 ? (
                              <>O cartão <b>{c.name}</b> será apagado.</>
                            ) : (
                              <>
                                O cartão <b>{c.name}</b> e <b>{n === 1 ? "a compra dele" : `as ${n} compras dele`}</b>, de todos os meses, serão apagados. Valores “a receber” ligados saem junto, menos os que já têm recebimento. Não dá para desfazer.
                              </>
                            )
                          }
                        >
                          <IconTrash width={16} height={16} />
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Próximas faturas</p>
                    <div className="mt-2 grid grid-cols-4 items-end gap-2">
                      {next.map((x, i) => (
                        <Link key={x.ym} href={`/cartoes/${c.id}?mes=${x.ym}`} className="rounded-lg text-center transition hover:opacity-80">
                          <div className="flex h-20 items-end justify-center rounded-lg bg-zinc-50 px-2 dark:bg-zinc-800/60">
                            <div className={`w-full rounded-t-md ${i === 0 ? "bg-blue-600" : "bg-blue-200 dark:bg-blue-900"}`} style={{ height: `${Math.max(4, (x.totalCents / max) * 100)}%` }} />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold">{monthShort(x.ym)}</p>
                          <p className="tabular muted text-[10px]">{formatBRL(x.totalCents)}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ),
            };
          })}
        />
      )}
    </>
  );
}
