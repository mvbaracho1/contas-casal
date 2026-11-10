import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconPlus } from "./icons";

/** Barra superior das páginas: título (com navegação opcional de mês) + ações. */
export function PageHeader({
  title,
  subtitle,
  prevHref,
  nextHref,
  actions,
  addButton = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  prevHref?: string;
  nextHref?: string;
  actions?: React.ReactNode;
  addButton?: boolean;
}) {
  return (
    <div className="card flex items-center gap-2 py-3 sm:py-3.5">
      {prevHref && (
        <Link href={prevHref} className="btn-icon" aria-label="Mês anterior"><IconChevronLeft /></Link>
      )}
      {nextHref && (
        <Link href={nextHref} className="btn-icon -ml-1" aria-label="Próximo mês"><IconChevronRight /></Link>
      )}
      <div className="min-w-0 flex-1 pl-1">
        <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {addButton && (
          <Link href="/compras/nova" className="btn hidden sm:inline-flex">
            <IconPlus /> Adicionar
          </Link>
        )}
      </div>
    </div>
  );
}
