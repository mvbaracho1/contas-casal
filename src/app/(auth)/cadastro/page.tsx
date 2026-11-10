import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/lib/google";

export default function CadastroPage() {
  return <AuthForm mode="cadastro" googleEnabled={googleEnabled()} />;
}
