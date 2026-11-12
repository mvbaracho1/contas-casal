// Garante que o banco (e DATABASE_URL) nunca vá para o bundle do navegador:
// importar este módulo num componente "use client" quebra o build.
import "server-only";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

// PRISMA_QUERY_LOG=1 mostra no terminal cada consulta e quanto demorou (para investigar lentidão).
function create() {
  if (process.env.PRISMA_QUERY_LOG !== "1") return new PrismaClient();
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  client.$on("query", (e) => console.log(`[prisma] ${e.duration}ms ${e.query.slice(0, 120)}`));
  return client;
}

export const prisma = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
