import Link from "next/link";
import { logout } from "@/app/actions";
import { IconCard, IconChevronRight, IconLogout, IconUsers, IconWallet } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";

const MORE_LINKS = [
  { href: "/cartoes", label: "Cartões", desc: "Faturas, limites e vencimentos", icon: IconCard },
  { href: "/renda", label: "Nossa renda", desc: "Salários e proporção do casal", icon: IconWallet },
  { href: "/casal", label: "Casal", desc: "Membros e código de convite", icon: IconUsers },
];

export default function MaisPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Mais" addButton={false} />
      <section className="card p-2 sm:p-2">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {MORE_LINKS.map(({ href, label, desc, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Icon width={18} height={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="muted block truncate text-xs">{desc}</span>
                </span>
                <IconChevronRight className="text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="card flex items-center justify-between">
        <span className="text-sm">Tema</span>
        <ThemeToggle />
      </section>
      <form action={logout}>
        <button className="btn-danger w-full justify-center rounded-2xl border border-zinc-200/70 bg-white py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <IconLogout /> Sair da conta
        </button>
      </form>
    </div>
  );
}
