import Link from "next/link";
import { logout } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <nav className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-2">
          <Link href="/" className="mr-3 font-bold">💑 Contas</Link>
          <Link href="/" className="btn-ghost">Resumo</Link>
          <Link href="/compras" className="btn-ghost">Compras</Link>
          <Link href="/casal" className="btn-ghost">Casal</Link>
          <span className="ml-auto hidden text-sm text-zinc-500 sm:inline">{user.name}</span>
          <form action={logout}>
            <button className="btn-ghost">Sair</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
