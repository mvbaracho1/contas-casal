import "server-only";
import { extractTextItems, getDocumentProxy } from "unpdf";

export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? "Senha incorreta" : "PDF protegido por senha");
  }
}

/**
 * Extrai o texto do PDF reconstruindo as linhas pela posição (y) de cada trecho,
 * já que o PDF guarda pedaços soltos de texto, não linhas.
 */
export async function pdfLines(data: Uint8Array, password?: string): Promise<string[]> {
  let doc;
  try {
    doc = await getDocumentProxy(data, { password: password || undefined });
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") throw new PdfPasswordError(err.code === 2);
    throw e;
  }
  {
    const { items } = await extractTextItems(doc);
    const lines: string[] = [];
    for (const page of items) {
      const rows: { y: number; parts: { x: number; w: number; s: string }[] }[] = [];
      for (const it of page) {
        if (!it.str.trim()) continue;
        const tol = Math.max(2, (it.height || 8) * 0.4);
        let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
        if (!row) rows.push((row = { y: it.y, parts: [] }));
        row.parts.push({ x: it.x, w: it.width, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y); // de cima para baixo
      for (const r of rows) {
        r.parts.sort((a, b) => a.x - b.x);
        let line = "";
        let lastEnd = -Infinity;
        for (const p of r.parts) {
          line += (line && p.x - lastEnd > 1 ? " " : "") + p.s;
          lastEnd = p.x + p.w;
        }
        lines.push(line.replace(/\s+/g, " ").trim());
      }
    }
    return lines;
  }
}
