import { describe, expect, it } from "vitest";
import {
  addMonths,
  parseBRL,
  splitInstallments,
  summarizeMonth,
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
