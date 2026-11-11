import "server-only";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";

/** Cookie que guarda o código durante o cadastro com o Google. */
export const SIGNUP_CODE_COOKIE = "cc_signup_code";

const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60_000;

function expectedCode() {
  const c = process.env.SIGNUP_CODE?.trim() ?? "";
  return /^\d{6}$/.test(c) ? c : null;
}

/**
 * O cadastro sem convite exige o código de acesso?
 * Em produção, sempre (sem SIGNUP_CODE configurado o cadastro fica fechado).
 * Em desenvolvimento, só se SIGNUP_CODE estiver definido.
 */
export function signupCodeRequired() {
  return Boolean(expectedCode()) || process.env.NODE_ENV === "production";
}

export function normalizeSignupCode(raw: unknown) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * Confere o código de acesso do cadastro (primeiro usuário do casal).
 * Devolve a mensagem de erro, ou null se pode cadastrar.
 * Limita a 10 tentativas erradas a cada 15 minutos por IP.
 */
export async function checkSignupCode(raw: unknown): Promise<string | null> {
  if (!signupCodeRequired()) return null;
  const expected = expectedCode();
  if (!expected) return "O cadastro está fechado no momento.";

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const fails = await prisma.signupCodeAttempt.count({ where: { ip, createdAt: { gt: since } } });
  if (fails >= MAX_FAILS) return "Muitas tentativas com código errado. Tente de novo em 15 minutos.";

  const code = normalizeSignupCode(raw);
  if (code.length === 6 && timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return null;

  await prisma.signupCodeAttempt.create({ data: { ip } });
  // limpeza das tentativas antigas (não precisa de tarefa agendada)
  await prisma.signupCodeAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } });
  return code.length === 6 ? "Código de acesso inválido." : "Informe o código de acesso de 6 dígitos.";
}
