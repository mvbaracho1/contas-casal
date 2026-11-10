import Link from "next/link";
import { CreateCoupleForm, JoinCoupleForm } from "@/components/couple-forms";
import { PageHeader } from "@/components/page-header";
import { Avatar, Illustration } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CasalPage() {
  const user = await requireUser();

  if (!user.coupleId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={`Bem-vindo(a), ${user.name}!`} subtitle="Crie o casal ou entre com o código do seu par" addButton={false} />
        <div className="grid gap-4 md:grid-cols-2">
          <CreateCoupleForm />
          <JoinCoupleForm />
        </div>
      </div>
    );
  }

  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: user.coupleId },
    include: { members: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } } },
  });
  const complete = couple.members.length === 2;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={couple.name} subtitle="Membros e convite" addButton={false} />
      <section className="card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="card-title">Membros</h2>
            <p className="muted text-xs">{complete ? "Casal completo" : "Falta 1 pessoa entrar"}</p>
          </div>
          <Illustration emoji="💑" />
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {couple.members.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 py-3 text-sm">
              <Avatar name={m.name} index={i} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.name}{m.id === user.id && <span className="muted font-normal"> (você)</span>}</p>
                <p className="muted truncate text-xs">{m.email}</p>
              </div>
            </li>
          ))}
        </ul>
        {complete ? (
          <Link href="/" className="btn w-full sm:w-auto">Ir para a visão geral</Link>
        ) : (
          <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/60">
            <p className="text-sm">Envie este código para seu par criar a conta e entrar no casal:</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em] break-all sm:text-3xl">{couple.inviteCode}</p>
          </div>
        )}
      </section>
    </div>
  );
}
