import "server-only";
import { cookies } from "next/headers";
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

export async function currentUser() {
  const jar = await cookies();
  const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, coupleId: true },
  });
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
  const couple = await prisma.couple.findUnique({
    where: { id: user.coupleId },
    include: { members: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!couple || couple.members.length < 2) redirect("/casal");
  const me = couple.members.find((m) => m.id === user.id)!;
  const partner = couple.members.find((m) => m.id !== user.id)!;
  const memberIds: [string, string] = [couple.members[0].id, couple.members[1].id];
  const names: Record<string, string> = Object.fromEntries(couple.members.map((m) => [m.id, m.name]));
  return { user, couple, me, partner, memberIds, names };
}
