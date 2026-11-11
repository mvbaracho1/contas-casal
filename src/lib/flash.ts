import "server-only";
import { cookies } from "next/headers";

/** Cookie com o aviso (toast) da última ação. Lido e apagado pelo <Toaster /> no navegador. */
export const FLASH_COOKIE = "cc_flash";

export type FlashType = "success" | "error" | "info";

/**
 * Agenda um toast para a próxima tela (funciona com redirect e com revalidatePath).
 * Só texto curto e sem dados sensíveis: o cookie é legível pelo navegador.
 */
export async function flash(message: string, type: FlashType = "success") {
  const jar = await cookies();
  // O Next já codifica o valor (encodeURIComponent); o Toaster decodifica uma vez.
  jar.set(FLASH_COOKIE, JSON.stringify({ id: Date.now() + Math.random(), type, message: message.slice(0, 200) }), {
    path: "/",
    maxAge: 20,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
