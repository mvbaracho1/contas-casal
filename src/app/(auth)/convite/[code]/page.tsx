import Link from "next/link";
import { AcceptInviteForm } from "@/components/couple-forms";
import { currentUser } from "@/lib/auth";
import { findInvite } from "@/lib/couple-invite";

export const metadata = { title: "Convite · Contas do Casal" };

function Box({ emoji, title, children }: { emoji: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card space-y-4 p-6 text-center shadow-xl shadow-zinc-900/5 sm:p-8 dark:shadow-black/30">
      <p className="text-4xl" aria-hidden>{emoji}</p>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [invite, user] = await Promise.all([findInvite(code), currentUser()]);

  if (!invite || invite.full) {
    return (
      <Box emoji="🔗" title={invite ? "Esse casal já está completo" : "Convite não encontrado"}>
        <p className="muted text-sm">Confira o link com quem te convidou ou peça o código de convite.</p>
        <Link href={user ? "/" : "/login"} className="btn w-full py-2.5">{user ? "Ir para o app" : "Ir para o login"}</Link>
      </Box>
    );
  }

  const title = <><span className="text-blue-600 dark:text-blue-400">{invite.inviterName}</span> convidou você</>;

  if (user?.coupleId) {
    return (
      <Box emoji="💑" title={title}>
        <p className="muted text-sm">Você está logado como <b>{user.email}</b>, que já faz parte de um casal. Para aceitar este convite, saia e entre com outra conta.</p>
        <Link href="/" className="btn w-full py-2.5">Ir para o app</Link>
      </Box>
    );
  }

  if (user) {
    return (
      <Box emoji="💑" title={title}>
        <p className="muted text-sm">Para dividir as contas no <b className="text-zinc-700 dark:text-zinc-200">{invite.coupleName}</b>.</p>
        <AcceptInviteForm code={invite.code} />
      </Box>
    );
  }

  const qs = new URLSearchParams({ convite: invite.code, ...(invite.inviteEmail && { email: invite.inviteEmail }) });
  return (
    <Box emoji="💑" title={title}>
      <p className="muted text-sm">
        Para dividir compras, contas e acertos no <b className="text-zinc-700 dark:text-zinc-200">{invite.coupleName}</b>. Crie sua conta e você já entra no casal.
      </p>
      <Link href={`/cadastro?${qs}`} className="btn w-full py-2.5">Criar minha conta</Link>
      <Link href={`/login?${qs}`} className="block text-sm font-semibold text-blue-600 dark:text-blue-400">Já tenho conta</Link>
    </Box>
  );
}
