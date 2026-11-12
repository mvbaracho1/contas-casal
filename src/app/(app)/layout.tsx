import Link from "next/link";
import { logout } from "@/app/actions";
import { IconLogout } from "@/components/icons";
import { BottomNav, SidebarNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui";
import { getSession, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // mesma busca da página (getSession tem cache por requisição): o layout não consulta o banco de novo
  const couple = (await getSession())?.couple ?? null;
  const members = couple?.members ?? [{ id: user.id, name: user.name }];
  const myIndex = Math.max(0, members.findIndex((m) => m.id === user.id));
  const complete = members.length === 2;

  const brand = (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="flex -space-x-2">
        {members.map((m, i) => <Avatar key={m.id} name={m.name} index={i} />)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold">{couple?.name ?? "Contas do Casal"}</span>
        <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">Finanças em casal</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:flex lg:gap-4 lg:p-4">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-60 shrink-0 flex-col rounded-2xl border border-zinc-200/70 bg-white p-3 lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-1 pt-1 pb-5">{brand}</div>
        <SidebarNav />
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between px-3 py-1 text-[13px] text-zinc-600 dark:text-zinc-400">
            Tema <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200/70 p-2.5 dark:border-zinc-800">
            <Avatar name={user.name} index={myIndex} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{user.name}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className={`size-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} />
                {complete ? "Casal conectado" : "Aguardando par"}
              </p>
            </div>
            <form action={logout}>
              <button className="btn-icon" aria-label="Sair" title="Sair"><IconLogout /></button>
            </form>
          </div>
        </div>
      </aside>

      {/* Header (celular/tablet) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-[#f2f4f8]/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-lg lg:hidden dark:border-zinc-800 dark:bg-zinc-950/85">
        {brand}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={logout}>
            <button className="btn-icon" aria-label="Sair"><IconLogout /></button>
          </form>
        </div>
      </header>

      <main className="w-full min-w-0 flex-1 space-y-4 px-3 pt-3 pb-28 sm:px-4 lg:p-0">{children}</main>

      <BottomNav />
    </div>
  );
}
