import { IconCalendar, IconCard, IconUsers } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  { icon: IconUsers, title: "Quem deve quanto a quem", text: "Compras e contas divididas do jeito de vocês, com o acerto do mês pronto." },
  { icon: IconCard, title: "Cartões e parcelas", text: "Faturas, limites e parcelamentos acompanhados mês a mês." },
  { icon: IconCalendar, title: "Contas fixas em dia", text: "Aluguel, condomínio e assinaturas com lembrete de vencimento." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f2f4f8] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] dark:bg-zinc-950">
      {/* Painel da marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-12 text-white lg:flex lg:flex-col">
        <span aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full bg-rose-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-blue-950/20">
            <LogoMark className="size-7" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Contas do Casal</span>
        </div>

        <div className="relative my-auto max-w-md py-12">
          <h1 className="text-4xl leading-tight font-bold tracking-tight xl:text-5xl">
            As finanças do casal, <span className="text-blue-200">sem planilha</span> e sem briga.
          </h1>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon width={18} height={18} />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-blue-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-200">Seus dados ficam só entre vocês dois.</p>
      </aside>

      {/* Formulário */}
      <section className="relative flex min-h-dvh flex-col">
        {/* Topo com a marca (celular/tablet) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-20 text-center text-white lg:hidden">
          <span aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-white/10 blur-3xl" />
          <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-blue-950/20">
            <LogoMark className="size-9" />
          </span>
          <h1 className="relative mt-3 text-2xl font-bold tracking-tight">Contas do Casal</h1>
          <p className="relative text-sm text-blue-100">Compras, parcelas e quem deve quanto a quem</p>
        </div>

        <div className="absolute top-4 right-4 z-10 lg:top-6 lg:right-6">
          <ThemeToggle />
        </div>

        <div className="relative -mt-12 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}
