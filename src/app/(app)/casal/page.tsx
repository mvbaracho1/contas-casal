import Link from "next/link";
import { CopyButton, CreateCoupleForm, JoinCoupleForm, ResendInviteForm } from "@/components/couple-forms";
import { PageHeader } from "@/components/page-header";
import { Avatar, Illustration } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { inviteLink } from "@/lib/couple-invite";
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
  const link = complete ? "" : await inviteLink(couple.inviteCode);
  const sentAt = couple.inviteSentAt?.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

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
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-4 text-sm dark:bg-blue-950/50">
              {couple.inviteEmail && sentAt ? (
                <p>📬 Convite enviado para <b>{couple.inviteEmail}</b> em {sentAt}. Peça para seu par conferir também o spam.</p>
              ) : couple.inviteEmail ? (
                <p>⚠️ Não conseguimos enviar o convite para <b>{couple.inviteEmail}</b>. Tente de novo ou mande o link abaixo.</p>
              ) : (
                <p>Informe o e-mail do seu par para enviarmos o convite.</p>
              )}
            </div>
            <ResendInviteForm defaultEmail={couple.inviteEmail ?? ""} />
            <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/60">
              <p className="text-sm">Ou mande o link (ou o código) direto, por WhatsApp por exemplo:</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{link}</p>
                <CopyButton text={link} />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em] break-all sm:text-3xl">{couple.inviteCode}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
