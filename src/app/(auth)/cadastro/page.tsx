import { AuthForm } from "@/components/auth-form";
import { findInvite } from "@/lib/couple-invite";
import { googleEnabled } from "@/lib/google";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ convite?: string; email?: string }> }) {
  const { convite, email } = await searchParams;
  const invite = convite ? await findInvite(convite) : null;
  return (
    <AuthForm
      mode="cadastro"
      googleEnabled={googleEnabled()}
      invite={invite && !invite.full ? invite : undefined}
      defaultEmail={email ?? invite?.inviteEmail ?? ""}
    />
  );
}
