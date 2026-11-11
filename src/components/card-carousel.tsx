"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons";

export type CarouselSlide = {
  id: string;
  label: string;
  /** link que seleciona o cartão no painel (atualiza fatura e próximas faturas) */
  selectHref: string;
  /** link dos detalhes do cartão */
  detailHref: string;
  node: React.ReactNode;
};

/**
 * Carrossel com um cartão por vez. Deslizar, usar as setas ou as bolinhas
 * seleciona o cartão visível; tocar no cartão abre os detalhes.
 */
export function CardCarousel({ slides, selectedId }: { slides: CarouselSlide[]; selectedId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const selected = Math.max(0, slides.findIndex((s) => s.id === selectedId));

  // mostra o cartão selecionado (ao abrir a página ou ao mudar a seleção por fora)
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollLeft / el.clientWidth) !== selected) el.scrollTo({ left: selected * el.clientWidth, behavior: "instant" });
  }, [selected]);

  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: Math.min(Math.max(i, 0), slides.length - 1) * el.clientWidth, behavior: "smooth" });
  };

  // quando a rolagem para, o cartão visível vira o selecionado
  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== selected && slides[i]) router.replace(slides[i].selectHref, { scroll: false });
    }, 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const arrow = "btn-icon absolute top-1/2 z-10 size-9 -translate-y-1/2 border border-zinc-200 bg-white/90 shadow-sm backdrop-blur disabled:opacity-0 dark:border-zinc-700 dark:bg-zinc-900/90";

  return (
    <div className="mt-4">
      <div className="relative">
        <div
          ref={ref}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s) => (
            <div key={s.id} className="w-full shrink-0 snap-center snap-always px-1 py-1">
              <Link href={s.detailHref} aria-label={`Ver detalhes do ${s.label}`} className="mx-auto block max-w-sm rounded-2xl">
                {s.node}
              </Link>
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <>
            <button type="button" className={`${arrow} left-0 -translate-x-1/4`} onClick={() => go(selected - 1)} disabled={selected === 0} aria-label="Cartão anterior">
              <IconChevronLeft width={16} height={16} />
            </button>
            <button type="button" className={`${arrow} right-0 translate-x-1/4`} onClick={() => go(selected + 1)} disabled={selected === slides.length - 1} aria-label="Próximo cartão">
              <IconChevronRight width={16} height={16} />
            </button>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Mostrar ${s.label}`}
              aria-current={i === selected}
              className={`h-1.5 rounded-full transition-all ${i === selected ? "w-5 bg-blue-600" : "w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
