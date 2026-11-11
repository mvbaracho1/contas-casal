import { describe, expect, it } from "vitest";
import {
  addMonths,
  linesForMonth,
  invoiceMonthFor,
  parseBRL,
  splitInstallments,
  summarizeMonth,
  type BillLike,
  type PurchaseLike,
  type SettlementLike,
} from "./ledger";

const MARIDO = "marido";
const ESPOSA = "esposa";
const members: [string, string] = [MARIDO, ESPOSA];

function p(over: Partial<PurchaseLike>): PurchaseLike {
  return {
    id: Math.random().toString(36),
    description: "x",
    totalCents: 10000,
    installments: 1,
    firstMonth: "2026-11",
    paidById: MARIDO,
    payerSharePct: 50,
    ...over,
  };
}

describe("utilitários", () => {
  it("soma meses virando o ano", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
  it("divide parcelas sem perder centavos", () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });
  it("lê valores em reais", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("1234.56")).toBe(123456);
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL("R$ 10")).toBe(1000);
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("summarizeMonth", () => {
  it("compra dividida 50/50 paga pelo marido: esposa deve metade", () => {
    const s = summarizeMonth([p({ totalCents: 20000 })], [], "2026-11", members);
    expect(s.monthDebt).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 10000 });
  });

  it("esposa compra parcelado no cartão do marido, só dela: deve cada parcela inteira", () => {
    const compra = p({ totalCents: 30000, installments: 3, payerSharePct: 0 });
    for (const m of ["2026-11", "2026-12", "2027-01"]) {
      const s = summarizeMonth([compra], [], m, members);
      expect(s.monthDebt).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 10000 });
      expect(s.consumptionBy[ESPOSA]).toBe(10000);
      expect(s.paidBy[MARIDO]).toBe(10000);
    }
    expect(summarizeMonth([compra], [], "2027-02", members).lines).toHaveLength(0);
  });

  it("compensa compras dos dois lados", () => {
    const s = summarizeMonth(
      [
        p({ totalCents: 20000 }), // esposa deve 100
        p({ totalCents: 6000, paidById: ESPOSA }), // marido deve 30
      ],
      [],
      "2026-11",
      members,
    );
    expect(s.monthDebt).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 7000 });
  });

  it("transferência quita o mês e o acumulado leva pendência antiga", () => {
    const compras = [
      p({ totalCents: 20000, installments: 2, payerSharePct: 0 }), // 100/mês da esposa
    ];
    const acertos: SettlementLike[] = [
      { id: "s1", month: "2026-11", fromId: ESPOSA, toId: MARIDO, amountCents: 10000 },
    ];
    const nov = summarizeMonth(compras, acertos, "2026-11", members);
    expect(nov.monthPending.amountCents).toBe(0);

    const dez = summarizeMonth(compras, acertos, "2026-12", members);
    expect(dez.monthPending).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 10000 });
    expect(dez.cumulative).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 10000 });

    const semAcerto = summarizeMonth(compras, [], "2026-12", members);
    expect(semAcerto.cumulative.amountCents).toBe(20000);
  });
});

describe("contas fixas e renda", () => {
  const bill = (over: Partial<BillLike>): BillLike => ({
    id: "b", name: "Aluguel", amountCents: 100000, dueDay: 5, paidById: MARIDO,
    payerSharePct: null, startMonth: "2026-01", endMonth: null, ...over,
  });
  const incomes = [
    { userId: MARIDO, amountCents: 600000, startMonth: "2026-01", endMonth: null },
    { userId: ESPOSA, amountCents: 400000, startMonth: "2026-01", endMonth: null },
  ];

  it("divide proporcional à renda: esposa ganha 40%, deve 40% do aluguel", () => {
    const s = summarizeMonth([], [], "2026-11", members, { bills: [bill({})], incomes });
    expect(s.monthDebt).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 40000 });
    expect(s.consumptionBy[MARIDO]).toBe(60000);
  });

  it("sem renda cadastrada, proporcional vira 50/50", () => {
    const s = summarizeMonth([], [], "2026-11", members, { bills: [bill({})], incomes: [] });
    expect(s.monthDebt.amountCents).toBe(50000);
  });

  it("conta pessoal (100% de quem paga) não gera dívida; respeita vigência", () => {
    const f = { bills: [bill({ payerSharePct: 100 }), bill({ id: "c", payerSharePct: 50, endMonth: "2026-10" })], incomes };
    const s = summarizeMonth([], [], "2026-11", members, f);
    expect(s.monthDebt.amountCents).toBe(0);
    expect(s.lines).toHaveLength(1);
    expect(summarizeMonth([], [], "2026-10", members, f).monthDebt.amountCents).toBe(50000);
  });

  it("acumulado conta meses anteriores das contas fixas", () => {
    const s = summarizeMonth([], [], "2026-03", members, { bills: [bill({ payerSharePct: 50 })], incomes });
    expect(s.cumulative.amountCents).toBe(150000);
  });
});

describe("invoiceMonthFor", () => {
  it("antes do fechamento cai na fatura do mês; depois, na seguinte", () => {
    expect(invoiceMonthFor("2026-11-03", 10, 17)).toBe("2026-11");
    expect(invoiceMonthFor("2026-11-10", 10, 17)).toBe("2026-12");
  });
  it("vencimento antes do fechamento joga para o mês seguinte", () => {
    expect(invoiceMonthFor("2026-11-03", 28, 5)).toBe("2026-12");
    expect(invoiceMonthFor("2026-12-29", 28, 5)).toBe("2027-02");
  });
});

describe("começar a contar de uma parcela", () => {
  const p = { id: "x", description: "TV", totalCents: 100000, installments: 10, firstMonth: "2026-09", startInstallment: 3, paidById: "a", payerSharePct: 50 };
  it("ignora as parcelas anteriores", () => {
    expect(linesForMonth([p], "2026-09")).toEqual([]);
    expect(linesForMonth([p], "2026-10")).toEqual([]);
    expect(linesForMonth([p], "2026-11")[0]).toMatchObject({ number: 3, of: 10, amountCents: 10000 });
    expect(linesForMonth([p], "2027-06")[0]).toMatchObject({ number: 10 });
  });
});

describe("compra proporcional à renda", () => {
  const p = { id: "r", description: "Sofá", totalCents: 300000, installments: 3, firstMonth: "2026-11", paidById: MARIDO, payerSharePct: null };
  const incomes = [
    { userId: MARIDO, amountCents: 600000, startMonth: "2026-01", endMonth: null },
    { userId: ESPOSA, amountCents: 400000, startMonth: "2026-01", endMonth: null },
  ];
  it("divide pela renda do mês (60/40)", () => {
    const s = summarizeMonth([p], [], "2026-11", members, { bills: [], incomes });
    expect(s.lines[0]).toMatchObject({ amountCents: 100000, payerShareCents: 60000, otherShareCents: 40000 });
    expect(s.monthDebt).toEqual({ debtorId: ESPOSA, creditorId: MARIDO, amountCents: 40000 });
  });
  it("sem renda cadastrada fica 50/50", () => {
    const s = summarizeMonth([p], [], "2026-11", members, { bills: [], incomes: [] });
    expect(s.lines[0].otherShareCents).toBe(50000);
  });
});

describe("compra recorrente (assinatura)", () => {
  const netflix = { id: "n", description: "Netflix", totalCents: 5590, installments: 1, firstMonth: "2026-11", recurring: true, endMonth: null, paidById: MARIDO, payerSharePct: 50 };
  it("repete o valor cheio todo mês a partir do início", () => {
    expect(linesForMonth([netflix], "2026-10")).toEqual([]);
    expect(linesForMonth([netflix], "2026-11")[0]).toMatchObject({ amountCents: 5590, otherShareCents: 2795, recurring: true });
    expect(linesForMonth([netflix], "2027-08")[0].amountCents).toBe(5590);
  });
  it("para depois do mês final", () => {
    const cancelada = { ...netflix, endMonth: "2027-01" };
    expect(linesForMonth([cancelada], "2027-01")).toHaveLength(1);
    expect(linesForMonth([cancelada], "2027-02")).toEqual([]);
  });
});
