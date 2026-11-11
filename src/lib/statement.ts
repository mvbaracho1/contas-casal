// Leitura de faturas de cartão (texto do PDF, OFX ou CSV) -> lista de lançamentos.
// Lógica pura, sem banco: fácil de testar. O resultado sempre passa por uma tela
// de revisão, então aqui preferimos encontrar demais a deixar passar.

import { addMonths, recurringActive, type Ym } from "./ledger";

export interface StatementItem {
  /** "YYYY-MM-DD" ou null se a data não foi encontrada */
  date: string | null;
  description: string;
  /** sempre positivo */
  amountCents: number;
  /** parcela atual / total (null = à vista) */
  installment: { k: number; n: number } | null;
  /** charge = compra/encargo; credit = pagamento, estorno, crédito */
  kind: "charge" | "credit";
}

export interface StatementResult {
  items: StatementItem[];
  /** Mês de vencimento detectado no arquivo, se houver */
  dueMonth: Ym | null;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const CREDIT_WORDS = /\b(pagamento|pgto|pag\s+fatura|estorno|cr[eé]dito|desconto|reembolso|cashback|devolu[cç][aã]o|ajuste\s+a\s+cr)/i;
// Linhas de resumo da fatura (não são compras). A palavra precisa estar inteira:
// "TOTALPASS" ou "SALDOS & CIA" são lojas, não o "Total" da fatura.
const SKIP_WORDS = /^(total|subtotal|sub-total|saldo|valor\s+total|limite|pagamento\s+m[ií]nimo|encargos\s+financeiros\s+m[aá]ximos|juros\s+m[aá]ximos)(?![a-z0-9à-ú])/i;

const pad = (n: number) => String(n).padStart(2, "0");

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Texto normalizado para comparar descrições. */
export function normDesc(s: string) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function monthIndex(name: string) {
  const k = stripAccents(name).toLowerCase().slice(0, 3);
  const i = MONTHS.indexOf(k);
  return i >= 0 ? i : MONTHS_EN.indexOf(k);
}

/** Ano para uma data sem ano: a mesma do mês de referência, ou o anterior se o mês for "depois" dele. */
function inferYear(month: number, ref: Ym) {
  const [ry, rm] = ref.split("-").map(Number);
  return month > rm ? ry - 1 : ry;
}

function fullYear(y: number) {
  return y < 100 ? 2000 + y : y;
}

function validDate(y: number, m: number, d: number) {
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
}

// ---------- Valores e parcelas ----------

/** "1.234,56" -> 123456 (formato brasileiro); null se não for valor. */
function brlToCents(int: string, dec: string) {
  return Number(int.replace(/\./g, "")) * 100 + Number(dec);
}

/** Valor de CSV/OFX: aceita "R$ -1.234,56", "-1234.56", "1,234.56", "(10,00)". */
export function parseLooseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || /-|−/.test(s);
  if (/\bD$/i.test(s)) neg = true;
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && s.length - lastDot - 1 !== 3) normalized = s.replace(/,/g, "");
  else if (lastDot > lastComma) normalized = s.replace(/[.,]/g, ""); // "1.234" sem centavos
  else normalized = s;
  const v = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** Procura "Parcela 2/10", "PARC 02/10", "02 de 10", "2/10" na descrição. */
export function extractInstallment(desc: string): { k: number; n: number; rest: string } | null {
  const patterns = [
    /\bparc(?:ela)?s?\.?\s*(\d{1,2})\s*(?:\/|de|-)\s*(\d{1,2})\b/i,
    /(?:^|\s|-)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})(?=\s*$|\s)/i,
  ];
  for (const re of patterns) {
    // usa a ÚLTIMA ocorrência (o número da parcela costuma vir no fim)
    const all = [...desc.matchAll(new RegExp(re.source, re.flags + "g"))];
    for (const m of all.reverse()) {
      const k = Number(m[1]);
      const n = Number(m[2]);
      if (k >= 1 && n >= 2 && k <= n && n <= 72) {
        const rest = (desc.slice(0, m.index) + " " + desc.slice(m.index! + m[0].length))
          .replace(/\s+-\s*$/, "")
          .replace(/\s+/g, " ")
          .trim();
        return { k, n, rest };
      }
    }
  }
  return null;
}

function cleanDescription(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–·*]+|[\s\-–·*]+$/g, "")
    .trim();
}

function makeItem(date: string | null, rawDesc: string, signedCents: number, chargeIsNegative: boolean): StatementItem | null {
  let description = cleanDescription(rawDesc);
  if (!description || SKIP_WORDS.test(description)) return null;
  const inst = extractInstallment(description);
  if (inst) description = cleanDescription(inst.rest) || description;
  const isCharge = chargeIsNegative ? signedCents < 0 : signedCents > 0;
  const kind = !isCharge || CREDIT_WORDS.test(description) ? "credit" : "charge";
  if (signedCents === 0) return null;
  return {
    date,
    description,
    amountCents: Math.abs(signedCents),
    installment: inst ? { k: inst.k, n: inst.n } : null,
    kind,
  };
}

// ---------- PDF (texto em linhas) ----------

const DATE_NUM = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?![\d/])/;
const DATE_TXT = /^(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|feb|apr|may|aug|sep|oct|dec)[a-zç]*\.?(?:\s+(?:de\s+)?(\d{4}))?(?![a-z])/i;
// valor no formato brasileiro (obrigatório ter vírgula + 2 casas), com sinal opcional antes ou depois
const AMOUNT = /(-|−)?\s*(?:R\$\s*)?(-|−)?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)(\s*-(?!\d))?/g;

function readDate(s: string, ref: Ym): { date: string; len: number } | null {
  let m = DATE_NUM.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3] ? fullYear(Number(m[3])) : inferYear(mo, ref);
    if (!validDate(y, mo, d)) return null;
    return { date: `${y}-${pad(mo)}-${pad(d)}`, len: m[0].length };
  }
  m = DATE_TXT.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = monthIndex(m[2]) + 1;
    const y = m[3] ? Number(m[3]) : inferYear(mo, ref);
    if (!mo || !validDate(y, mo, d)) return null;
    return { date: `${y}-${pad(mo)}-${pad(d)}`, len: m[0].length };
  }
  return null;
}

/**
 * Lê uma linha que começa com data: "10/03 LOJA X 02/10 100,00".
 * Uma linha pode ter mais de um lançamento (faturas em duas colunas).
 */
export function parseStatementLine(line: string, ref: Ym): StatementItem[] {
  const out: StatementItem[] = [];
  let rest = line.trim();
  while (rest) {
    const d = readDate(rest, ref);
    if (!d) break;
    const body = rest.slice(d.len);
    AMOUNT.lastIndex = 0;
    let m: RegExpExecArray | null;
    let end = -1;
    let chosen: RegExpExecArray | null = null;
    while ((m = AMOUNT.exec(body))) {
      // o valor precisa ser separado por espaço do texto anterior
      if (m.index > 0 && !/\s|\$/.test(body[m.index - 1]) && !/^\s/.test(m[0])) continue;
      chosen = m;
      end = m.index + m[0].length;
      const after = body.slice(end).trimStart();
      if (!after || readDate(after, ref)) break; // fim do lançamento
    }
    if (!chosen) break;
    const desc = body.slice(0, chosen.index);
    const negative = Boolean(chosen[1] || chosen[2] || chosen[5]);
    const cents = brlToCents(chosen[3], chosen[4]) * (negative ? -1 : 1);
    // remove outros valores (ex.: em dólar) que ficaram na descrição
    const cleanDesc = desc.replace(AMOUNT, " ").replace(/\b(US\$|USD|R\$)\s*/gi, " ");
    const item = makeItem(d.date, cleanDesc, cents, false);
    if (item) out.push(item);
    rest = body.slice(end).trim();
  }
  return out;
}

/** Procura a data de vencimento: "Vencimento: 10/12/2026", "Data de vencimento 10 DEZ 2026". */
export function detectDueMonth(text: string): Ym | null {
  const flat = text.replace(/\s+/g, " ");
  const num = /venc(?:imento|e\s+em)?[^\d]{0,40}?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i.exec(flat);
  if (num) {
    const y = fullYear(Number(num[3]));
    const mo = Number(num[2]);
    if (validDate(y, mo, Number(num[1]))) return `${y}-${pad(mo)}`;
  }
  const txt = /venc(?:imento|e\s+em)?[^\d]{0,40}?(\d{1,2})\s*(?:de\s+)?([a-zç]{3,9})\.?\s*(?:de\s+)?(\d{4})/i.exec(flat);
  if (txt) {
    const mo = monthIndex(txt[2]) + 1;
    const y = Number(txt[3]);
    if (mo && validDate(y, mo, Number(txt[1]))) return `${y}-${pad(mo)}`;
  }
  return null;
}

/**
 * Títulos das seções que listam parcelas de faturas FUTURAS. Tudo depois deles
 * é ignorado, senão as parcelas seguintes entram como se fossem desta fatura.
 */
const FUTURE_SECTION = new RegExp(
  [
    String.raw`parcelamentos?\s+(?:da\s+)?pr[oó]xima\s+fatura`,
    String.raw`compras\s+parceladas\s*[-–:]?\s*pr[oó]ximas\s+faturas`,
    String.raw`parcelas\s+(?:a\s+vencer|futuras|das\s+pr[oó]ximas\s+faturas)`,
    String.raw`lan[cç]amentos\s+futuros`,
  ].join("|"),
  "i",
);

/** Linhas até o início da seção de faturas futuras (o trecho antes do título, na mesma linha, ainda vale). */
export function cutFutureSection(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const m = FUTURE_SECTION.exec(l);
    if (m) {
      const before = l.slice(0, m.index).trim();
      if (before) out.push(before);
      break;
    }
    out.push(l);
  }
  return out;
}

/** Texto do PDF (uma string por linha) -> lançamentos. `fallbackMonth` serve para deduzir o ano. */
export function parseStatementText(lines: string[], fallbackMonth: Ym): StatementResult {
  const dueMonth = detectDueMonth(lines.join("\n"));
  const ref = dueMonth ?? fallbackMonth;
  const items = cutFutureSection(lines).flatMap((l) => parseStatementLine(l, ref));
  return { items: dedupeSameLine(items), dueMonth };
}

/** Alguns PDFs repetem o texto (camadas). Remove lançamentos idênticos em sequência. */
function dedupeSameLine(items: StatementItem[]) {
  return items.filter((it, i) => {
    const prev = items[i - 1];
    return !prev || JSON.stringify(prev) !== JSON.stringify(it);
  });
}

// ---------- OFX ----------

function ofxField(block: string, tag: string) {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? m[1].trim() : "";
}

export function parseOfx(text: string): StatementResult {
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)].map((m) => m[1]);
  const raw = blocks
    .map((b) => {
      const dt = ofxField(b, "DTPOSTED");
      const date = /^\d{8}/.test(dt) ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : null;
      const cents = parseLooseAmount(ofxField(b, "TRNAMT").replace(",", "."));
      const desc = [ofxField(b, "NAME"), ofxField(b, "MEMO")].filter(Boolean);
      // MEMO costuma repetir/completar o NAME: usa o mais longo
      const description = desc.sort((a, c) => c.length - a.length)[0] ?? "";
      return { date, cents, description };
    })
    .filter((r) => r.cents !== null && r.description);

  // Em fatura de cartão a maioria dos lançamentos são compras: o sinal mais comum = compra.
  const negatives = raw.filter((r) => r.cents! < 0).length;
  const chargeIsNegative = negatives >= raw.length - negatives;
  const items = raw.map((r) => makeItem(r.date, r.description, r.cents!, chargeIsNegative)).filter((x): x is StatementItem => !!x);

  const end = ofxField(text, "DTEND") || ofxField(text, "DTDUE");
  const dueMonth = /^\d{6}/.test(end) ? `${end.slice(0, 4)}-${end.slice(4, 6)}` : null;
  return { items, dueMonth };
}

// ---------- CSV ----------

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseAnyDate(s: string, ref: Ym): string | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(s);
  if (m) {
    const mo = Number(m[2]);
    const y = m[3] ? fullYear(Number(m[3])) : inferYear(mo, ref);
    return validDate(y, mo, Number(m[1])) ? `${y}-${pad(mo)}-${pad(Number(m[1]))}` : null;
  }
  const r = readDate(s, ref);
  return r ? r.date : null;
}

export function parseCsv(text: string, fallbackMonth: Ym): StatementResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  // acha a linha de cabeçalho (algum banco põe linhas de título antes)
  const headerIdx = lines.findIndex((l) => /data|date/i.test(stripAccents(l)) && /valor|amount|value/i.test(stripAccents(l)));
  if (headerIdx < 0) return { items: [], dueMonth: null };
  const headerLine = lines[headerIdx];
  const sep = [";", ",", "\t"].sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
  const header = splitCsvLine(headerLine, sep).map((h) => stripAccents(h).toLowerCase());

  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iDate = find("data", "date");
  const iDesc = find("descri", "lancamento", "title", "estabelecimento", "historico", "nome", "memo");
  // prefere a coluna em reais quando houver uma em dólar
  let iAmount = header.findIndex((h) => /valor|amount|value/.test(h) && /r\$|real|brl/.test(h));
  if (iAmount < 0) iAmount = header.findIndex((h) => /valor|amount|value/.test(h) && !/us\$|dolar|usd/.test(h));
  const iInst = find("parcela");
  if (iDate < 0 || iDesc < 0 || iAmount < 0) return { items: [], dueMonth: null };

  const raw = lines.slice(headerIdx + 1).map((l) => {
    const cols = splitCsvLine(l, sep);
    const cents = parseLooseAmount(cols[iAmount] ?? "");
    let description = cols[iDesc] ?? "";
    // coluna de parcela separada ("2/10" ou "2 de 10"): junta na descrição para o extrator achar
    if (iInst >= 0 && cols[iInst] && /\d/.test(cols[iInst])) description += ` Parcela ${cols[iInst]}`;
    return { date: parseAnyDate(cols[iDate] ?? "", fallbackMonth), cents, description };
  }).filter((r) => r.cents !== null && r.description);

  const negatives = raw.filter((r) => r.cents! < 0).length;
  const chargeIsNegative = negatives > raw.length - negatives;
  const items = raw.map((r) => makeItem(r.date, r.description, r.cents!, chargeIsNegative)).filter((x): x is StatementItem => !!x);
  return { items, dueMonth: null };
}

// ---------- Compras já cadastradas ----------

export interface ExistingPurchase {
  description: string;
  totalCents: number;
  installments: number;
  firstMonth: Ym;
  cardId: string | null;
  recurring?: boolean;
  endMonth?: Ym | null;
}

/** Mês da 1ª parcela de um lançamento da fatura do mês `month`. */
export function firstMonthFor(item: Pick<StatementItem, "installment">, month: Ym): Ym {
  return addMonths(month, -((item.installment?.k ?? 1) - 1));
}

/** Esse lançamento já foi cadastrado (ex.: importado na fatura do mês anterior)? */
export function isDuplicate(item: StatementItem, month: Ym, cardId: string | null, existing: ExistingPurchase[]) {
  const n = item.installment?.n ?? 1;
  const first = firstMonthFor(item, month);
  const desc = normDesc(item.description);
  const sameDesc = (d: string) => {
    const pd = normDesc(d);
    return pd === desc || pd.startsWith(desc.slice(0, 8)) || desc.startsWith(pd.slice(0, 8));
  };
  return existing.some((p) => {
    if (p.cardId !== cardId) return false;
    if (p.recurring) {
      // assinatura já cadastrada: aparece de novo em toda fatura enquanto estiver ativa
      if (item.installment || !recurringActive(p, month)) return false;
      return Math.abs(p.totalCents - item.amountCents) <= 2 && sameDesc(p.description);
    }
    if (p.installments !== n || p.firstMonth !== first) return false;
    if (Math.abs(p.totalCents / n - item.amountCents) > 2) return false;
    return sameDesc(p.description);
  });
}
