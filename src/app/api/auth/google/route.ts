import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { INVITE_COOKIE, normalizeInviteCode } from "@/lib/couple-invite";
import { normalizeSignupCode, SIGNUP_CODE_COOKIE } from "@/lib/signup-code";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleEnabled } from "@/lib/google";

// Início do login com Google: gera o "state" anti-CSRF e manda para o Google.
export async function GET(req: NextRequest) {
  if (!googleEnabled()) redirect("/login?erro=google_desativado");

  const base = await appUrl();
  // O cookie de state precisa ficar no mesmo domínio do retorno.
  if (req.nextUrl.origin !== base) redirect(`${base}/api/auth/google${req.nextUrl.search}`);

  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 } as const;
  jar.set(GOOGLE_STATE_COOKIE, state, opts);
  // Veio de um convite: guarda o código para entrar no casal na volta do Google.
  const invite = normalizeInviteCode(req.nextUrl.searchParams.get("convite"));
  if (invite) jar.set(INVITE_COOKIE, invite, opts);
  else jar.delete(INVITE_COOKIE);
  // Código de acesso (cadastro do primeiro do casal): conferido na volta, só se for criar conta.
  const signupCode = normalizeSignupCode(req.nextUrl.searchParams.get("codigo"));
  if (signupCode) jar.set(SIGNUP_CODE_COOKIE, signupCode, opts);
  else jar.delete(SIGNUP_CODE_COOKIE);
  redirect(googleAuthUrl(`${base}/api/auth/google/callback`, state));
}
