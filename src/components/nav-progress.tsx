"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Barra de progresso no topo durante a troca de página.
 * Começa no clique de um link interno e termina quando a nova rota aparece.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState(0); // 0 = escondida
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rota mudou: completa a barra e some.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress((p) => (p > 0 ? 100 : 0));
    const t = setTimeout(() => setProgress(0), 250);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      if (timer.current) return;
      setProgress(8);
      // avança cada vez mais devagar, sem chegar ao fim antes da página carregar
      timer.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 150);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // mesma página (ou só #âncora)
      if (url.pathname.startsWith("/api/")) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-200"
      style={{ opacity: progress > 0 && progress < 100 ? 1 : 0 }}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-rose-500 shadow-[0_0_8px_rgba(37,99,235,0.6)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
