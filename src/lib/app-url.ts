import "server-only";
import { headers } from "next/headers";

/**
 * URL pública do app, usada em links de e-mail e no retorno do Google.
 * Em produção vem de APP_URL ou do domínio de produção da Vercel — nunca do
 * cabeçalho Host da requisição (que um atacante poderia forjar num e-mail de reset).
 */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.NODE_ENV === "production") throw new Error("Defina APP_URL com a URL pública do app");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
