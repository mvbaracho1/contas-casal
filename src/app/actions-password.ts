"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { findValidResetToken, hashResetToken } from "@/lib/password-reset";
import type { FormState } from "./actions";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const RESEND_COOLDOWN_MS = 60 * 1000; // no máximo 1 e-mail por minuto por conta

// A resposta é sempre a mesma, exista a conta ou não (para não revelar e-mails cadastrados).
const GENERIC_OK = "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também o spam.";

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: GENERIC_OK };

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
  });
  if (recent) return { ok: GENERIC_OK };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const link = `${await appUrl()}/redefinir-senha?token=${token}`;
  try {
    await sendMail({
      to: user.email,
      subject: "Crie uma nova senha · Contas do Casal",
      text: `Olá, ${user.name}!\n\nPara criar uma nova senha, abra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você que pediu, ignore este e-mail.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 12px">Crie uma nova senha</h2>
  <p>Olá, ${user.name.replace(/[<>&"]/g, "")}! Recebemos um pedido para trocar a senha da sua conta no <b>Contas do Casal</b>.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Criar nova senha</a></p>
  <p style="color:#71717a;font-size:13px">O link vale por 1 hora e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail.</p>
</div>`,
    });
  } catch (e) {
    console.error("[reset] falha ao enviar e-mail:", e);
    return { error: "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos." };
  }
  return { ok: GENERIC_OK };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres" };
  if (password !== confirm) return { error: "As senhas não conferem" };

  const row = await findValidResetToken(token);
  if (!row) return { error: "Esse link expirou ou já foi usado. Peça um novo." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  await startSession(row.userId);
  redirect("/");
}
