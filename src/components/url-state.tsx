"use client";

// Filtros e seleções guardados na URL (?filtro=, ?ver=, ?editar=…) que trocam na hora,
// sem pedir a página de novo ao servidor. O servidor manda todas as variações já
// renderizadas e aqui só escolhemos qual mostrar. Como o valor vem da URL, recarregar,
// compartilhar o link e o redirect depois de salvar continuam funcionando.

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type SetOptions = {
  /** cria uma entrada no histórico (o "voltar" desfaz). Padrão: substitui. */
  push?: boolean;
  /** id de um elemento para rolar até ele no celular (ex.: o formulário de edição) */
  scrollTo?: string;
  /** outros parâmetros que devem ser limpos junto */
  clear?: string[];
};

function hrefWith(pathname: string, current: URLSearchParams, param: string, value: string, clear: string[] = []) {
  const sp = new URLSearchParams(current);
  for (const k of clear) sp.delete(k);
  if (value) sp.set(param, value);
  else sp.delete(param);
  const qs = sp.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

/** Valor atual de um parâmetro da URL ("" quando não existe) e como trocá-lo sem navegar. */
export function useUrlParam(param: string) {
  const sp = useSearchParams();
  const value = sp.get(param) ?? "";
  const set = useCallback(
    (next: string, opts: SetOptions = {}) => {
      const href = hrefWith(window.location.pathname, new URLSearchParams(window.location.search), param, next, opts.clear);
      if (opts.push) window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
      if (opts.scrollTo && window.innerWidth < 1024) {
        requestAnimationFrame(() => document.getElementById(opts.scrollTo!)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [param],
  );
  return [value, set] as const;
}

/**
 * Link que troca um parâmetro da URL na hora. Continua sendo um <a> de verdade
 * (abrir em nova aba funciona). `toggle`: clicar de novo no ativo limpa o valor.
 * O elemento recebe data-active="true" quando ativo (use `group-data-[active=true]:`).
 */
export function ParamLink({
  param,
  value,
  toggle,
  push,
  scrollTo,
  clear,
  className = "",
  activeClassName = "",
  inactiveClassName = "",
  children,
  ...rest
}: {
  param: string;
  value: string;
  toggle?: boolean;
  push?: boolean;
  scrollTo?: string;
  clear?: string[];
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  title?: string;
}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const [current, set] = useUrlParam(param);
  const active = current === value;
  const target = toggle && active ? "" : value;
  const href = hrefWith(pathname, new URLSearchParams(sp), param, target, clear);
  return (
    <a
      href={href}
      data-active={active}
      aria-current={active ? "true" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nova aba: deixa o navegador abrir
        e.preventDefault();
        set(target, { push, scrollTo, clear });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

type Condition = { param?: string; values?: string[]; when?: Record<string, string[]>; not?: boolean };

function useMatches({ param, values, when, not }: Condition) {
  const sp = useSearchParams();
  const all = { ...(when ?? {}), ...(param ? { [param]: values ?? [""] } : {}) };
  const ok = Object.entries(all).every(([k, vs]) => vs.includes(sp.get(k) ?? ""));
  return not ? !ok : ok;
}

/**
 * Mostra o conteúdo só quando a URL bate com a condição ("" = parâmetro ausente).
 * `param` + `values` para um parâmetro; `when` para vários ao mesmo tempo (todos precisam bater);
 * `not` inverte.
 */
export function ParamView({ children, ...cond }: Condition & { children: React.ReactNode }) {
  return useMatches(cond) ? <>{children}</> : null;
}

/** Aplica classes conforme a URL (ex.: destacar o item selecionado de uma lista). */
export function ParamClass({
  className = "",
  activeClassName = "",
  inactiveClassName = "",
  children,
  ...cond
}: Condition & {
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: React.ReactNode;
}) {
  const on = useMatches(cond);
  return <div className={`${className} ${on ? activeClassName : inactiveClassName}`}>{children}</div>;
}
