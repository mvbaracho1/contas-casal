import "server-only";

export function mailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Envia e-mail pela API do Resend (sem SDK). Sem RESEND_API_KEY, em
 * desenvolvimento só mostra o e-mail no terminal.
 */
export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  if (!mailEnabled()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[e-mail de teste] Para: ${to}\nAssunto: ${subject}\n${text}\n`);
      return;
    }
    throw new Error("Envio de e-mail não configurado (RESEND_API_KEY / EMAIL_FROM)");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar e-mail (${res.status}): ${await res.text()}`);
}
