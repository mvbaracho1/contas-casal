"use client";

import { IconMoon, IconSun } from "./icons";

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

/** Alternador claro/escuro. O estado ativo vem do CSS (classe .dark), sem hidratação. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const base = "inline-flex size-7 items-center justify-center rounded-full transition";
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800 ${className}`}>
      <button
        type="button" aria-label="Tema claro" onClick={() => setTheme("light")}
        className={`${base} bg-white text-zinc-900 shadow-sm dark:bg-transparent dark:text-zinc-400 dark:shadow-none`}
      >
        <IconSun width={14} height={14} />
      </button>
      <button
        type="button" aria-label="Tema escuro" onClick={() => setTheme("dark")}
        className={`${base} text-zinc-400 dark:bg-zinc-700 dark:text-white dark:shadow-sm`}
      >
        <IconMoon width={14} height={14} />
      </button>
    </div>
  );
}
