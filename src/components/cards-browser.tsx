"use client";

import { CardCarousel } from "./card-carousel";
import { useUrlParam } from "./url-state";

export type BrowserCard = {
  id: string;
  name: string;
  detailHref: string;
  /** o cartão desenhado */
  node: React.ReactNode;
  /** fatura, limite, próximas faturas e ações (já renderizados no servidor) */
  details: React.ReactNode;
};

/**
 * Lista de cartões em carrossel: um por vez, com os dados do cartão visível embaixo.
 * O cartão escolhido fica em ?cartao= (troca no navegador, sem recarregar a página).
 */
export function CardsBrowser({ cards }: { cards: BrowserCard[] }) {
  const [current, set] = useUrlParam("cartao");
  const sel = cards.find((c) => c.id === current) ?? cards[0];
  return (
    <section className="card">
      <div className="mx-auto max-w-md">
        <CardCarousel
          selectedId={sel.id}
          onSelect={(id) => set(id)}
          slides={cards.map((c) => ({ id: c.id, label: c.name, detailHref: c.detailHref, node: c.node }))}
        />
      </div>
      <p className="muted mt-2 text-center text-xs">
        {cards.length > 1 ? `${cards.findIndex((c) => c.id === sel.id) + 1} de ${cards.length} · deslize ou use as setas` : "Toque no cartão para ver as compras"}
      </p>
      <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800" aria-live="polite">
        {sel.details}
      </div>
    </section>
  );
}
