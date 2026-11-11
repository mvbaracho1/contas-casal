import "server-only";
import { appUrl } from "./app-url";
import { prisma } from "./db";
import { sendMail } from "./mail";

/** Cookie que guarda o código do convite durante o login com o Google. */
export const INVITE_COOKIE = "cc_invite";
export const INVITE_RESEND_COOLDOWN_MS = 60_000;

export function normalizeInviteCode(raw: unknown) {
  const code = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

export async function inviteLink(code: string) {
  return `${await appUrl()}/convite/${code}`;
}

/** Coloca o usuário no casal do código. Devolve a mensagem de erro, ou null se deu certo. */
export async function joinByCode(userId: string, rawCode: unknown): Promise<string | null> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return "Código inválido";
  const couple = await prisma.couple.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });
  if (!couple) return "Código não encontrado";
  if (couple._count.members >= 2) return "Esse casal já está completo";
  // Só entra quem ainda não tem casal (evita corrida com dois convites ao mesmo tempo).
  const { count } = await prisma.user.updateMany({ where: { id: userId, coupleId: null }, data: { coupleId: couple.id } });
  return count ? null : "Você já faz parte de um casal";
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Envia o e-mail de convite. Devolve true se enviou (ou, em dev sem Resend, se mostrou no terminal). */
export async function sendCoupleInvite(opts: { to: string; inviterName: string; coupleName: string; code: string }) {
  const link = await inviteLink(opts.code);
  try {
    await sendMail({
      to: opts.to,
      subject: `${opts.inviterName} convidou você para o Contas do Casal`,
      text: `Olá!\n\n${opts.inviterName} convidou você para dividir as contas no "${opts.coupleName}".\n\nAbra o link para criar sua conta e entrar no casal:\n${link}\n\nSe preferir, use o código de convite ${opts.code} depois de criar a conta.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 12px">Você recebeu um convite 💑</h2>
  <p><b>${esc(opts.inviterName)}</b> convidou você para dividir compras, contas e acertos no <b>${esc(opts.coupleName)}</b>, no Contas do Casal.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Aceitar convite</a></p>
  <p style="color:#71717a;font-size:13px">Se o botão não funcionar, crie sua conta e use o código <b style="font-family:monospace;letter-spacing:2px">${opts.code}</b>.</p>
</div>`,
    });
    return true;
  } catch (e) {
    console.error("[convite] falha ao enviar e-mail:", e);
    return false;
  }
}

/** Dados do convite para mostrar nas telas (null se o código não existe). */
export async function findInvite(rawCode: unknown) {
  const code = normalizeInviteCode(rawCode);
  if (!code) return null;
  const couple = await prisma.couple.findUnique({
    where: { inviteCode: code },
    include: { members: { select: { name: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!couple) return null;
  return {
    code,
    coupleName: couple.name,
    inviterName: couple.members[0]?.name ?? "Seu par",
    inviteEmail: couple.inviteEmail ?? "",
    full: couple.members.length >= 2,
  };
}
