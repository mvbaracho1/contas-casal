"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import { IconChevronRight } from "./icons";

// Cards que abrem e fecham (visão geral). Começam fechados: só o cabeçalho (título e
// valor principal) aparece. A escolha de cada card fica salva neste navegador, e um link
// para o card (#acerto, #amigos…) abre ele sozinho.

type Ctx = { open: boolean; toggle: () => void; label: string; bodyId: string };
const CollapseContext = createContext<Ctx | null>(null);

/** Estado do card mais próximo (null fora de um <Collapsible>: aí tudo fica aberto). */
export function useCollapse() {
  return useContext(CollapseContext);
}

// v2: a partir daqui todos os cards começam fechados (ignora o que ficou salvo antes)
const KEY = (k: string) => `cc:card:v2:${k}`;

export function Collapsible({
  storageKey,
  label,
  id,
  className,
  collapsedClassName,
  openOnHash = [],
  children,
}: {
  storageKey: string;
  /** Nome do card para o leitor de tela ("Compras do mês") */
  label: string;
  id?: string;
  className: string;
  collapsedClassName: string;
  /** links que abrem o card (além de #id), ex.: ["#contestacoes"] */
  openOnHash?: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const hashes = [...(id ? [`#${id}`] : []), ...openOnHash].join("|");

  // Depois de montar: preferência salva e link apontando para o card (evita diferença servidor/navegador).
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY(storageKey)) === "aberto") setOpen(true);
    } catch {
      /* sem acesso ao armazenamento: fica fechado */
    }
    const byHash = () => {
      if (hashes && hashes.split("|").includes(window.location.hash)) setOpen(true);
    };
    byHash();
    window.addEventListener("hashchange", byHash);
    return () => window.removeEventListener("hashchange", byHash);
  }, [storageKey, hashes]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY(storageKey), o ? "fechado" : "aberto");
      } catch {
        /* ignora */
      }
      return !o;
    });
  }, [storageKey]);

  return (
    <CollapseContext.Provider value={{ open, toggle, label, bodyId }}>
      <section id={id} className={open ? className : collapsedClassName}>{children}</section>
    </CollapseContext.Provider>
  );
}

/** Botão de abrir/fechar (seta). */
export function CollapseToggle({ className = "" }: { className?: string }) {
  const c = useCollapse();
  if (!c) return null;
  return (
    <button
      type="button"
      onClick={c.toggle}
      aria-expanded={c.open}
      aria-controls={c.bodyId}
      aria-label={c.open ? `Recolher ${c.label}` : `Mostrar ${c.label}`}
      className={`btn-icon -mt-1 -mr-1 shrink-0 ${className}`}
    >
      <IconChevronRight className={`transition-transform duration-200 ${c.open ? "rotate-90" : ""}`} />
    </button>
  );
}

/** Conteúdo que só aparece com o card aberto; fechado, mostra "Mostrar detalhes →". */
export function CollapseBody({ children, more = "Mostrar detalhes" }: { children: React.ReactNode; more?: string }) {
  const c = useCollapse();
  if (!c || c.open) return <div id={c?.bodyId} className="contents">{children}</div>;
  return (
    <button type="button" onClick={c.toggle} className="mt-3 self-start text-left text-xs font-medium text-blue-600 dark:text-blue-400">
      {more} →
    </button>
  );
}

/**
 * Atalho para o caso simples: cabeçalho (`header` + `aside`) sempre visível e
 * `children` só com o card aberto.
 */
export function CollapsibleCard({
  storageKey,
  label,
  id,
  className,
  collapsedClassName,
  openOnHash,
  header,
  aside,
  more,
  children,
}: {
  storageKey: string;
  label: string;
  id?: string;
  className: string;
  collapsedClassName: string;
  openOnHash?: string[];
  header: React.ReactNode;
  aside?: React.ReactNode;
  more?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible storageKey={storageKey} label={label} id={id} className={className} collapsedClassName={collapsedClassName} openOnHash={openOnHash}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        {aside}
        <CollapseToggle />
      </div>
      <CollapseBody more={more}>{children}</CollapseBody>
    </Collapsible>
  );
}
