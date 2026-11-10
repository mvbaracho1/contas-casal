import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, googleEnabled, googleProfile } from "@/lib/google";

function sameState(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Retorno do Google: confere o state, valida o id_token e entra (criando a conta se preciso).
export async function GET(req: NextRequest) {
  if (!googleEnabled()) redirect("/login?erro=google_desativado");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.delete(GOOGLE_STATE_COOKIE);

  if (req.nextUrl.searchParams.get("error")) redirect("/login?erro=google_cancelado");
  if (!code || !state || !expected || !sameState(state, expected)) redirect("/login?erro=google_state");

  let profile: Awaited<ReturnType<typeof googleProfile>>;
  try {
    profile = await googleProfile(code, `${await appUrl()}/api/auth/google/callback`);
  } catch (e) {
    console.error("[google] falha no login:", e);
    redirect("/login?erro=google_falhou");
  }
  if (!profile.email || !profile.emailVerified) redirect("/login?erro=google_email");

  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      // Mesmo e-mail (verificado pelo Google): liga a conta existente ao Google.
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub } });
    } else {
      user = await prisma.user.create({
        data: { name: profile.name || profile.email.split("@")[0], email: profile.email, googleId: profile.sub },
      });
    }
  }

  await startSession(user.id);
  redirect(user.coupleId ? "/" : "/casal");
}
