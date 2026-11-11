"use client";

import { useEffect, useId, useState } from "react";
import { IconChevronRight } from "./icons";

/**
 * Card que abre e fecha. O cabeçalho (`header` + `aside`) fica sempre visível;
 * `children` só aparece aberto. A escolha fica salva neste navegador.
 */
export function CollapsibleCard({
  storageKey,
  label,
  className,
  collapsedClassName,
  header,
  aside,
  children,
}: {
  storageKey: string;
  /** Nome do card para o leitor de tela ("Compras do mês") */
  label: string;
  className: string;
  collapsedClassName: string;
  header: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  // Lê a preferência depois de montar (evita diferença entre servidor e navegador).
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "fechado") setOpen(false);
    } catch {
      /* sem acesso ao armazenamento: fica aberto */
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey, o ? "fechado" : "aberto");
      } catch {
        /* ignora */
      }
      return !o;
    });
  };

  return (
    <section className={open ? className : collapsedClassName}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        {aside}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `Recolher ${label}` : `Mostrar ${label}`}
          className="btn-icon -mt-1 -mr-1 shrink-0"
        >
          <IconChevronRight className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
      </div>
      {open ? (
        <div id={bodyId} className="contents">{children}</div>
      ) : (
        <button type="button" onClick={toggle} className="mt-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400">
          Mostrar lista →
        </button>
      )}
    </section>
  );
}
