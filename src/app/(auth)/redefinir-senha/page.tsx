import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-form";
import { findValidResetToken } from "@/lib/password-reset";

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await findValidResetToken(token);

  if (!row) {
    return (
      <div className="card space-y-4 p-6 text-center shadow-xl shadow-zinc-900/5 sm:p-8">
        <p className="text-4xl" aria-hidden>⏳</p>
        <h2 className="text-xl font-bold tracking-tight">Link expirado ou já usado</h2>
        <p className="muted text-sm">Os links de recuperação valem por 1 hora e só funcionam uma vez.</p>
        <Link href="/esqueci-senha" className="btn w-full py-2.5">Pedir um novo link</Link>
        <Link href="/login" className="block text-sm font-semibold text-blue-600 dark:text-blue-400">Voltar para o login</Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} email={row.user.email} />;
}
