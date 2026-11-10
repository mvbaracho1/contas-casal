"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBag, IconCalendar, IconCard, IconGrid, IconMenu, IconPlus, IconUsers, IconWallet } from "./icons";

const MENU = [
  { href: "/", label: "Visão geral", icon: IconGrid },
  { href: "/compras", label: "Compras", icon: IconBag },
  { href: "/cartoes", label: "Cartões", icon: IconCard },
  { href: "/contas", label: "Contas fixas", icon: IconCalendar },
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

/** Barra de abas fixa no rodapé (celular/tablet). */
export function BottomNav() {
  const path = usePathname();
  const tab = (href: string, label: string, Icon: typeof IconGrid, also?: string[]) => {
    const active = also ? also.some((h) => path.startsWith(h)) : isActive(path, href);
    return (
      <Link
        href={href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${
          active ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        <Icon width={20} height={20} />
        {label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="mx-auto flex max-w-md items-center px-2">
        {tab("/", "Visão geral", IconGrid)}
        {tab("/compras", "Compras", IconBag)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/compras/nova"
            aria-label="Nova compra"
            className="-mt-6 flex size-13 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-[#f2f4f8] transition active:scale-95 dark:ring-zinc-950"
          >
            <IconPlus width={24} height={24} />
          </Link>
        </div>
        {tab("/contas", "Contas", IconCalendar)}
        {tab("/mais", "Mais", IconMenu, ["/mais", "/cartoes", "/renda", "/casal"])}
      </div>
    </nav>
  );
}
