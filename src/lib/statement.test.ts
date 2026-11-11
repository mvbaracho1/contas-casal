import { describe, expect, it } from "vitest";
import {
  detectDueMonth,
  extractInstallment,
  isDuplicate,
  parseCsv,
  parseLooseAmount,
  parseOfx,
  parseStatementLine,
  parseStatementText,
} from "./statement";

describe("parcelas na descrição", () => {
  it("reconhece os formatos comuns", () => {
    expect(extractInstallment("MAGAZINE LUIZA PARC 02/10")).toMatchObject({ k: 2, n: 10, rest: "MAGAZINE LUIZA" });
    expect(extractInstallment("Amazon - Parcela 3/12")).toMatchObject({ k: 3, n: 12, rest: "Amazon" });
    expect(extractInstallment("LOJAS RENNER 01 de 05")).toMatchObject({ k: 1, n: 5 });
    expect(extractInstallment("NETSHOES 04/06")).toMatchObject({ k: 4, n: 6, rest: "NETSHOES" });
  });
  it("ignora o que não é parcela", () => {
    expect(extractInstallment("UBER TRIP")).toBeNull();
    expect(extractInstallment("LOJA 12/03")).toBeNull(); // 12 > 3: parece data, não parcela
  });
});

describe("valores", () => {
  it("lê formatos brasileiro e americano", () => {
    expect(parseLooseAmount("R$ 1.234,56")).toBe(123456);
    expect(parseLooseAmount("-1234.56")).toBe(-123456);
    expect(parseLooseAmount("1,234.56")).toBe(123456);
    expect(parseLooseAmount("(10,00)")).toBe(-1000);
    expect(parseLooseAmount("89.9")).toBe(8990);
  });
});

describe("linhas de PDF", () => {
  const ref = "2026-11";
  it("Nubank: data com mês por extenso", () => {
    const [it1] = parseStatementLine("08 OUT Mercado Livre - Parcela 2/6 R$ 150,00", ref);
    expect(it1).toEqual({ date: "2026-10-08", description: "Mercado Livre", amountCents: 15000, installment: { k: 2, n: 6 }, kind: "charge" });
  });
  it("Itaú: duas colunas na mesma linha", () => {
    const items = parseStatementLine("10/10 DROGASIL 45,90 12/10 POSTO IPIRANGA 02/03 200,00", ref);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ date: "2026-10-10", description: "DROGASIL", amountCents: 4590 });
    expect(items[1]).toMatchObject({ description: "POSTO IPIRANGA", amountCents: 20000, installment: { k: 2, n: 3 } });
  });
  it("compra internacional: usa o valor em reais (o último)", () => {
    const [it1] = parseStatementLine("15/10 NETFLIX.COM US$ 10,00 55,30", ref);
    expect(it1).toMatchObject({ description: "NETFLIX.COM", amountCents: 5530 });
  });
  it("pagamentos e estornos viram crédito", () => {
    expect(parseStatementLine("05/10 PAGAMENTO RECEBIDO -1.500,00", ref)[0]).toMatchObject({ kind: "credit", amountCents: 150000 });
    expect(parseStatementLine("06/10 ESTORNO LOJA X 30,00", ref)[0].kind).toBe("credit");
    expect(parseStatementLine("07/10 LOJA Y 30,00-", ref)[0].kind).toBe("credit");
  });
  it("ano anterior quando o mês é depois do vencimento", () => {
    expect(parseStatementLine("20/12 PRESENTE 10,00", "2027-01")[0].date).toBe("2026-12-20");
  });
  it("ignora linhas sem data e totais", () => {
    expect(parseStatementLine("Total da fatura 1.234,56", ref)).toEqual([]);
    expect(parseStatementLine("10/10 Total 99,00", ref)).toEqual([]);
  });
  it("detecta o vencimento", () => {
    expect(detectDueMonth("Vencimento: 10/12/2026")).toBe("2026-12");
    expect(detectDueMonth("Data de vencimento 05 DEZ 2026")).toBe("2026-12");
    const r = parseStatementText(["Vencimento 10/01/2027", "28/12 LOJA 10,00"], "2026-11");
    expect(r.dueMonth).toBe("2027-01");
    expect(r.items[0].date).toBe("2026-12-28");
  });
});

describe("OFX", () => {
  it("lê lançamentos e define o sinal das compras", () => {
    const ofx = `OFXHEADER:100
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<DTSTART>20261001<DTEND>20261031
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003120000[-3:BRT]<TRNAMT>-89.90<FITID>1<MEMO>IFOOD *RESTAURANTE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261004<TRNAMT>-250.00<FITID>2<MEMO>MAGALU PARC 03/10</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261010<TRNAMT>1000.00<FITID>3<MEMO>PAGAMENTO EFETUADO</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    const r = parseOfx(ofx);
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ date: "2026-10-03", description: "IFOOD *RESTAURANTE", amountCents: 8990, kind: "charge" });
    expect(r.items[1]).toMatchObject({ description: "MAGALU", installment: { k: 3, n: 10 }, kind: "charge" });
    expect(r.items[2].kind).toBe("credit");
  });
});

describe("seção de próximas faturas", () => {
  it("ignora tudo depois de 'Parcelamentos Próxima Fatura'", () => {
    const lines = [
      "Vencimento 10/12/2026",
      "08/11 MAGAZINE LUIZA 03/10 249,90",
      "12/11 UBER TRIP 23,90",
      "Parcelamentos Próxima Fatura",
      "08/11 MAGAZINE LUIZA 04/10 249,90",
      "15/10 RENNER 02/05 80,00",
    ];
    const r = parseStatementText(lines, "2026-11");
    expect(r.items.map((i) => i.description)).toEqual(["MAGAZINE LUIZA", "UBER TRIP"]);
    expect(r.items[0].installment).toEqual({ k: 3, n: 10 });
  });
  it("aceita variações do título e corta no meio da linha", () => {
    const r = parseStatementText(["10/11 PADARIA 12,00 COMPRAS PARCELADAS - PRÓXIMAS FATURAS", "10/11 TV 02/10 300,00"], "2026-11");
    expect(r.items.map((i) => i.description)).toEqual(["PADARIA"]);
  });
});

describe("CSV", () => {
  it("Nubank (date,title,amount)", () => {
    const csv = "date,title,amount\n2026-10-02,Padaria Pão Quente,23.5\n2026-10-03,Amazon - Parcela 2/5,120.00\n2026-10-05,Pagamento recebido,-500.00";
    const r = parseCsv(csv, "2026-11");
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ date: "2026-10-02", amountCents: 2350, kind: "charge" });
    expect(r.items[1]).toMatchObject({ description: "Amazon", installment: { k: 2, n: 5 } });
    expect(r.items[2].kind).toBe("credit");
  });
  it("Inter (; e R$)", () => {
    const csv = '"Data";"Lançamento";"Categoria";"Tipo";"Valor"\n"02/10/2026";"POSTO SHELL";"TRANSPORTE";"Compra à vista";"R$ 180,00"\n"03/10/2026";"CASAS BAHIA";"COMPRAS";"Parcela 4/10";"R$ 99,90"';
    const r = parseCsv(csv, "2026-11");
    expect(r.items[0]).toMatchObject({ date: "2026-10-02", description: "POSTO SHELL", amountCents: 18000 });
    expect(r.items[1]).toMatchObject({ description: "CASAS BAHIA", amountCents: 9990 });
  });
});

describe("duplicadas", () => {
  it("reconhece a mesma compra parcelada na fatura seguinte", () => {
    const existing = [{ description: "MAGALU", totalCents: 250000, installments: 10, firstMonth: "2026-09", cardId: "c1" }];
    const item = { date: "2026-08-20", description: "MAGALU", amountCents: 25000, installment: { k: 3, n: 10 }, kind: "charge" as const };
    expect(isDuplicate(item, "2026-11", "c1", existing)).toBe(true);
    expect(isDuplicate(item, "2026-12", "c1", existing)).toBe(false);
    expect(isDuplicate(item, "2026-11", "c2", existing)).toBe(false);
  });
});

describe("assinatura já cadastrada", () => {
  const item = { date: "2026-12-15", description: "Netflix.com", amountCents: 5590, installment: null, kind: "charge" as const };
  const sub = { description: "Netflix.com", totalCents: 5590, installments: 1, firstMonth: "2026-11", cardId: "c1", recurring: true, endMonth: null };
  it("é reconhecida nas faturas seguintes", () => {
    expect(isDuplicate(item, "2026-12", "c1", [sub])).toBe(true);
    expect(isDuplicate(item, "2027-05", "c1", [sub])).toBe(true);
  });
  it("não antes do início, depois do fim, em outro cartão ou com outro valor", () => {
    expect(isDuplicate(item, "2026-10", "c1", [sub])).toBe(false);
    expect(isDuplicate(item, "2027-02", "c1", [{ ...sub, endMonth: "2027-01" }])).toBe(false);
    expect(isDuplicate(item, "2026-12", "c2", [sub])).toBe(false);
    expect(isDuplicate({ ...item, amountCents: 6490 }, "2026-12", "c1", [sub])).toBe(false);
  });
});
