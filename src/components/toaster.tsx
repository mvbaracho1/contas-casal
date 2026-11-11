"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Toast = { id: number; type: "success" | "error" | "info"; message: string };

const COOKIE = "cc_flash"; // mesmo nome de FLASH_COOKIE (lib/flash.ts, só servidor)
const DURATION = 4000;

const STYLE = {
  success: { icon: "✓", ring: "bg-emerald-500" },
  error: { icon: "!", ring: "bg-red-500" },
  info: { icon: "i", ring: "bg-blue-600" },
};

/** Lê o aviso deixado pela última Server Action (cookie) e apaga em seguida. */
function takeFlash(): Toast | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
  try {
    const t = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)));
    return typeof t?.message === "string" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Toasts de sucesso das ações. `serverKey` muda sempre que o servidor
 * re-renderiza com um aviso novo (ações que ficam na mesma página);
 * a troca de rota cobre as ações que fazem redirect.
 */
export function Toaster({ serverKey }: { serverKey: string | null }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<number>());

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  useEffect(() => {
    const t = takeFlash();
    if (!t || seen.current.has(t.id)) return;
    seen.current.add(t.id);
    setToasts((ts) => [...ts.slice(-2), t]);
    const timer = setTimeout(() => dismiss(t.id), DURATION);
    return () => clearTimeout(timer);
  }, [pathname, search, serverKey, dismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] flex flex-col items-center gap-2 px-3 lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:items-end lg:px-0"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3 text-sm text-zinc-800 shadow-xl shadow-zinc-900/10 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-black/40"
        >
          <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${STYLE[t.type].ring}`} aria-hidden>
            {STYLE[t.type].icon}
          </span>
          <span className="min-w-0 flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="btn-icon -mr-2 size-7 shrink-0" aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
