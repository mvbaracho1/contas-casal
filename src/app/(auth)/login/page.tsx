import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/lib/google";

const ERRORS: Record<string, string> = {
  google_cancelado: "Login com o Google cancelado.",
  google_state: "A sessão do login com o Google expirou. Tente de novo.",
  google_falhou: "Não conseguimos entrar com o Google. Tente de novo.",
  google_email: "Sua conta Google não tem e-mail verificado.",
  google_desativado: "O login com o Google não está disponível.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <AuthForm mode="login" googleEnabled={googleEnabled()} notice={erro ? ERRORS[erro] : undefined} />;
}
