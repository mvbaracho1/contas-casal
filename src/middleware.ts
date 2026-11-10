import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!userId && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (userId && isPublic) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  // Ícones e manifest ficam públicos (o navegador os busca antes do login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|svg|ico|jpg)$).*)"],
};
