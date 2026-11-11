import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { NavProgress } from "@/components/nav-progress";
import { Toaster } from "@/components/toaster";
import { cookies } from "next/headers";
import { FLASH_COOKIE } from "@/lib/flash";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Contas do Casal",
  description: "Controle de compras, parcelas e acertos do casal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Aplica o tema antes da pintura para não piscar.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Muda quando uma Server Action deixa um aviso novo: faz o Toaster conferir o cookie.
  const flashKey = (await cookies()).get(FLASH_COOKIE)?.value ?? null;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Suspense fallback={null}>
          <NavProgress />
          <Toaster serverKey={flashKey} />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
