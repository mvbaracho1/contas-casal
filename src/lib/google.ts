import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Login com Google (OAuth 2.0 / OpenID Connect, fluxo "authorization code").

export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const GOOGLE_STATE_COOKIE = "cc_google_state";

export function googleAuthUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Troca o código pelo id_token e devolve os dados verificados da conta Google. */
export async function googleProfile(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google recusou o código (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google não devolveu id_token");

  // Confere assinatura, emissor e destinatário do token.
  const { payload } = await jwtVerify(id_token, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? "").toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: String(payload.name ?? payload.given_name ?? "").trim(),
  };
}
