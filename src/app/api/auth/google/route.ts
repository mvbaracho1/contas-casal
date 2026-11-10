import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleEnabled } from "@/lib/google";

// Início do login com Google: gera o "state" anti-CSRF e manda para o Google.
export async function GET(req: NextRequest) {
  if (!googleEnabled()) redirect("/login?erro=google_desativado");

  const base = await appUrl();
  // O cookie de state precisa ficar no mesmo domínio do retorno.
  if (req.nextUrl.origin !== base) redirect(`${base}/api/auth/google`);

  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  redirect(googleAuthUrl(`${base}/api/auth/google/callback`, state));
}
