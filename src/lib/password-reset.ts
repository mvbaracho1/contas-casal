import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";

export const hashResetToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Busca um token de recuperação válido (existe, não usado, não expirado). */
export async function findValidResetToken(token: string) {
  if (!token) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}
