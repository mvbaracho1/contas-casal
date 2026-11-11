import { AuthForm } from "@/components/auth-form";
import { findInvite } from "@/lib/couple-invite";
import { googleEnabled } from "@/lib/google";
import { signupCodeRequired } from "@/lib/signup-code";

const ERRORS: Record<string, string> = {
  google_codigo: "Para criar uma conta com o Google, informe primeiro o código de acesso.",
  google_codigo_invalido: "Código de acesso inválido (ou muitas tentativas). Confira e tente de novo.",
};

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ convite?: string; email?: string; erro?: string }> }) {
  const { convite, email, erro } = await searchParams;
  const invite = convite ? await findInvite(convite) : null;
  return (
    <AuthForm
      mode="cadastro"
      googleEnabled={googleEnabled()}
      invite={invite && !invite.full ? invite : undefined}
      defaultEmail={email ?? invite?.inviteEmail ?? ""}
      codeRequired={signupCodeRequired()}
      notice={erro ? ERRORS[erro] : undefined}
    />
  );
}
