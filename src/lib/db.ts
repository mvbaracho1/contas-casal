// Garante que o banco (e DATABASE_URL) nunca vá para o bundle do navegador:
// importar este módulo num componente "use client" quebra o build.
import "server-only";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
