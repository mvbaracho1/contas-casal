"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBRL } from "@/lib/ledger";
import { CardCarousel } from "./card-carousel";
import { Illustration, Money } from "./ui";

export type PanelCard = {
  id: string;
  name: string;
  detailHref: string;
  /** fatura do mês do painel e das duas seguintes (`name`: "dezembro", `detailHref`: detalhes naquele mês) */
  invoices: { ym: string; label: string; name: string; totalCents: number; detailHref: string }[];
  node: React.ReactNode;
};

/**
 * Card "Cartões" da visão geral. Os dados de todos os cartões e das próximas faturas
 * já vêm do servidor: trocar de cartão no carrossel ou de mês nas próximas faturas
 * só atualiza este card, sem recarregar a página.
 */
export function CardsPanel({ cards, initialId }: { cards: PanelCard[]; initialId: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  // mês escolhido nas próximas faturas (0 = mês do painel); vale para qualquer cartão
  const [monthIdx, setMonthIdx] = useState(0);
  const sel = cards.find((c) => c.id === selectedId) ?? cards[0];
  const inv = sel.invoices[monthIdx] ?? sel.invoices[0];
  const maxInv = Math.max(...sel.invoices.map((x) => x.totalCents), 1);

  const select = (id: string) => {
    setSelectedId(id);
    // guarda o cartão na URL (para recarregar ou voltar no mesmo), sem pedir a página de novo
    const url = new URL(window.location.href);
    url.searchParams.set("cartao", id);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="card-title">Cartões</h2>
          <p className="muted mt-3 truncate text-xs" aria-live="polite">Fatura de {inv.name} · {sel.name}</p>
          <Money cents={inv.totalCents} size="lg" />
        </div>
        <Illustration emoji="💳" />
      </div>
      <Link href={inv.detailHref} className="btn-outline mt-3 self-start">Ver fatura</Link>

      <CardCarousel
        selectedId={sel.id}
        onSelect={select}
        slides={cards.map((c) => ({ id: c.id, label: c.name, detailHref: c.detailHref, node: c.node }))}
      />

      <p className="mt-5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Próximas faturas</p>
      <div className="relative mt-2 grid flex-1 grid-cols-3 gap-2">
        {sel.invoices.map((u, i) => {
          const top = 75 - (u.totalCents / maxInv) * 28; // fica abaixo do selo "Atual"
          const on = i === monthIdx;
          return (
            <button
              key={u.ym}
              type="button"
              onClick={() => setMonthIdx(i)}
              aria-pressed={on}
              aria-label={`Fatura de ${u.name}: ${formatBRL(u.totalCents)}`}
              className={`relative flex min-h-32 flex-col items-center overflow-hidden rounded-xl border p-2 pt-3 text-center transition ${
                on ? "border-blue-500 bg-white ring-2 ring-blue-500/15 dark:bg-zinc-900" : "border-transparent bg-zinc-50 hover:border-zinc-200 dark:bg-zinc-800/60 dark:hover:border-zinc-700"
              }`}
            >
              <span className="text-xs font-semibold capitalize">{u.label}</span>
              {i === 0 && <span className="pill mt-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Atual</span>}
              {on && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-blue-100 to-blue-50/40 transition-all dark:from-blue-950 dark:to-transparent" style={{ top: `${top}%` }} />}
              <span className="absolute left-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-white transition-all dark:bg-zinc-900" style={{ top: `${top}%` }} />
              <span className={`tabular relative mt-auto text-xs font-semibold sm:text-[13px] ${on ? "text-blue-700 dark:text-blue-300" : "text-zinc-600 dark:text-zinc-300"}`}>
                {formatBRL(u.totalCents)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
