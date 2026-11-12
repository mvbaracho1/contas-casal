import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Usuário e casal da sessão, buscados **uma vez por requisição** (`cache` do React):
 * o layout e a página chamam isto e o banco só é consultado na primeira vez.
 * Usuário e casal vêm em paralelo, e o casal já com os membros numa consulta só (join).
 */
export const getSession = cache(async () => {
  const jar = await cookies();
  const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const [user, couple] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, coupleId: true },
    }),
    prisma.couple.findFirst({
      where: { members: { some: { id: userId } } },
      include: { members: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } } },
      relationLoadStrategy: "join",
    }),
  ]);
  if (!user) return null;
  return { user, couple: user.coupleId && couple?.id === user.coupleId ? couple : null };
});

export async function currentUser() {
  return (await getSession())?.user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige usuário logado e casal completo (2 pessoas). */
export async function requireCouple() {
  const user = await requireUser();
  if (!user.coupleId) redirect("/casal");
  const couple = (await getSession())?.couple;
  if (!couple || couple.members.length < 2) redirect("/casal");
  const me = couple.members.find((m) => m.id === user.id)!;
  const partner = couple.members.find((m) => m.id !== user.id)!;
  const memberIds: [string, string] = [couple.members[0].id, couple.members[1].id];
  const names: Record<string, string> = Object.fromEntries(couple.members.map((m) => [m.id, m.name]));
  return { user, couple, me, partner, memberIds, names };
}
