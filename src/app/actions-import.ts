"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMonths, currentYm } from "@/lib/ledger";
import { parseCsv, parseOfx, parseStatementText, type StatementResult } from "@/lib/statement";
import { PdfPasswordError, pdfLines } from "@/lib/statement-pdf";

const MAX_STATEMENT_BYTES = 4 * 1024 * 1024;

export type ReadState =
  | { error?: string; needsPassword?: boolean; result?: StatementResult & { fileName: string; format: "pdf" | "ofx" | "csv" } }
  | undefined;

/** OFX/CSV de banco brasileiro às vezes vem em Windows-1252, não UTF-8. */
function decodeText(buf: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Lê o arquivo da fatura e devolve os lançamentos para revisão (não grava nada). */
export async function readStatement(_: ReadState, form: FormData): Promise<ReadState> {
  await requireCouple();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo da fatura" };
  if (file.size > MAX_STATEMENT_BYTES) return { error: "Arquivo muito grande (máximo 4 MB)" };

  const buf = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder("latin1").decode(buf.slice(0, 1024));
  const name = file.name.toLowerCase();
  const fallback = currentYm();

  try {
    if (head.startsWith("%PDF")) {
      const password = String(form.get("password") ?? "");
      const lines = await pdfLines(buf, password);
      if (lines.join("").replace(/\s/g, "").length < 50) {
        return { error: "Esse PDF parece ser uma imagem (escaneado), sem texto para ler. Tente baixar a fatura de novo pelo app do banco, ou exporte em OFX/CSV." };
      }
      return { result: { ...parseStatementText(lines, fallback), fileName: file.name, format: "pdf" } };
    }
    const text = decodeText(buf);
    if (/<OFX>|OFXHEADER/i.test(text) || name.endsWith(".ofx")) {
      return { result: { ...parseOfx(text), fileName: file.name, format: "ofx" } };
    }
    if (name.endsWith(".csv") || name.endsWith(".txt") || /[;,]/.test(text.split("\n")[0] ?? "")) {
      return { result: { ...parseCsv(text, fallback), fileName: file.name, format: "csv" } };
    }
    return { error: "Formato não reconhecido. Use PDF, OFX ou CSV." };
  } catch (e) {
    if (e instanceof PdfPasswordError) {
      return {
        needsPassword: true,
        error: e.wrong ? "Senha incorreta. Confira e tente de novo." : "Esse PDF tem senha. Normalmente são os primeiros dígitos do CPF do titular.",
      };
    }
    console.error("[importar] falha ao ler a fatura:", e);
    return { error: "Não conseguimos ler esse arquivo. Confira se é a fatura em PDF, OFX ou CSV." };
  }
}

const importSchema = z.object({
  cardId: z.string().nullable(),
  paidById: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        amountCents: z.number().int().positive().max(100_000_000),
        k: z.number().int().min(1).max(72),
        n: z.number().int().min(1).max(72),
        /** null = proporcional à renda */
        payerSharePct: z.number().int().min(0).max(100).nullable(),
        category: z.string().trim().max(60).nullable().optional(),
      }).refine((i) => i.k <= i.n, "Parcela inválida"),
    )
    .min(1, "Selecione ao menos um lançamento")
    .max(500),
});

/** Grava os lançamentos escolhidos na revisão. */
export async function importStatement(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string } | undefined> {
  const { couple, memberIds } = await requireCouple();
  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Dados inválidos" };
  }
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!memberIds.includes(d.paidById)) return { error: "Pagador inválido" };
  if (d.cardId) {
    const card = await prisma.card.findFirst({ where: { id: d.cardId, coupleId: couple.id } });
    if (!card) return { error: "Cartão inválido" };
    if (card.ownerId !== d.paidById) return { error: "Esse cartão é de outra pessoa" };
  }

  await prisma.purchase.createMany({
    data: d.items.map((i) => ({
      coupleId: couple.id,
      description: i.description,
      category: i.category || null,
      // a fatura mostra o valor da parcela; o total é parcela × quantidade
      totalCents: i.amountCents * i.n,
      installments: i.n,
      startInstallment: i.k,
      firstMonth: addMonths(d.month, -(i.k - 1)),
      purchaseDate: new Date(`${i.date ?? `${d.month}-01`}T12:00:00Z`),
      paidById: d.paidById,
      payerSharePct: i.payerSharePct,
      cardId: d.cardId,
    })),
  });
  revalidatePath("/", "layout");
  redirect(`/?mes=${d.month}`);
}
