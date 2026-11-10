import Link from "next/link";
import { CreateCoupleForm, JoinCoupleForm } from "@/components/couple-forms";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CasalPage() {
  const user = await requireUser();

  if (!user.coupleId) {
    return (
      <>
        <h1 className="text-2xl font-bold">Bem-vindo(a), {user.name}!</h1>
        <p className="text-zinc-500">Para começar, crie o casal ou entre com o código enviado pelo seu par.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CreateCoupleForm />
          <JoinCoupleForm />
        </div>
      </>
    );
  }

  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: user.coupleId },
    include: { members: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } } },
  });
  const complete = couple.members.length === 2;

  return (
    <>
      <h1 className="text-2xl font-bold">{couple.name}</h1>
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">Membros</h2>
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {couple.members.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{m.name}{m.id === user.id && " (você)"}</span>
                <span className="truncate text-zinc-500">{m.email}</span>
              </li>
            ))}
          </ul>
        </div>
        {complete ? (
          <Link href="/" className="btn">Ir para o resumo</Link>
        ) : (
          <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950">
            <p className="text-sm">Envie este código para seu par criar a conta e entrar no casal:</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em]">{couple.inviteCode}</p>
          </div>
        )}
      </div>
    </>
  );
}
