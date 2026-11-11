"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBag, IconCalendar, IconCard, IconGrid, IconMenu, IconPlus, IconReceive, IconTarget, IconUsers, IconWallet } from "./icons";

const MENU = [
  { href: "/", label: "Visão geral", icon: IconGrid },
  { href: "/compras", label: "Compras", icon: IconBag },
  { href: "/cartoes", label: "Cartões", icon: IconCard },
  { href: "/contas", label: "Contas fixas", icon: IconCalendar },
  { href: "/receber", label: "A receber", icon: IconReceive },
  { href: "/metas", label: "Metas", icon: IconTarget },
];
const AJUSTES = [
  { href: "/renda", label: "Nossa renda", icon: IconWallet },
  { href: "/casal", label: "Casal", icon: IconUsers },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/compras") return path === "/compras" || (path.startsWith("/compras/") && path !== "/compras/nova");
  return path === href;
}

function SideLink({ href, label, icon: Icon }: (typeof MENU)[number]) {
  const active = isActive(usePathname(), href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white"
      }`}
    >
      <Icon className={active ? "text-blue-600 dark:text-blue-400" : ""} />
      {label}
    </Link>
  );
}

export function SidebarNav() {
  return (
    <nav className="space-y-5">
      <div>
        <p className="mb-1.5 px-3 text-[11px] font-medium text-zinc-400">Menu</p>
        <div className="space-y-0.5">{MENU.map((i) => <SideLink key={i.href} {...i} />)}</div>
      </div>
      <div>
        <p className="mb-1.5 px-3 text-[11px] font-medium text-zinc-400">Ajustes</p>
        <div className="space-y-0.5">{AJUSTES.map((i) => <SideLink key={i.href} {...i} />)}</div>
      </div>
    </nav>
  );
}

/** Menu flutuante no rodapé (celular/tablet): cápsula com as abas + botão de adicionar. */
export function BottomNav() {
  const path = usePathname();
  const tab = (href: string, label: string, Icon: typeof IconGrid, also?: string[]) => {
    const active = also ? also.some((h) => path.startsWith(h)) : isActive(path, href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium transition ${
          active
            ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20 dark:bg-white dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        }`}
      >
        <Icon width={19} height={19} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1 rounded-full border border-zinc-200/80 bg-white/85 p-1.5 shadow-xl shadow-zinc-900/10 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/85 dark:shadow-black/40">
          {tab("/", "Início", IconGrid)}
          {tab("/compras", "Compras", IconBag)}
          {tab("/contas", "Contas", IconCalendar)}
          {tab("/mais", "Mais", IconMenu, ["/mais", "/cartoes", "/renda", "/casal", "/receber", "/metas"])}
        </div>
        <Link
          href="/compras/nova"
          aria-label="Nova compra"
          className="pointer-events-auto flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/40 transition hover:bg-blue-700 active:scale-95"
        >
          <IconPlus width={24} height={24} />
        </Link>
      </div>
    </nav>
  );
}
