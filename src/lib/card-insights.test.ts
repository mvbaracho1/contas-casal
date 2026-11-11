import { describe, expect, it } from "vitest";
import { cardInsights, type CardPurchase } from "./card-insights";
import { invoicePurchases } from "./finance";

const members: [string, string] = ["ana", "joao"];
const base = { paidById: "ana", payerSharePct: 50, cardId: "c1", installments: 1, startInstallment: 1 } as const;
const purchases: CardPurchase[] = [
  { ...base, id: "mercado", description: "Mercado", totalCents: 40000, firstMonth: "2026-12" },
  { ...base, id: "tv", description: "TV", totalCents: 300000, installments: 10, firstMonth: "2026-10" }, // 3/10 em dez
  { ...base, id: "tenis", description: "Tênis", totalCents: 60000, installments: 3, firstMonth: "2026-11", payerSharePct: 0 }, // 2/3 em dez, acaba em jan
  { ...base, id: "netflix", description: "Netflix", totalCents: 5590, firstMonth: "2026-06", recurring: true, payerSharePct: 100 },
  { ...base, id: "show", description: "Show (Pedro)", totalCents: 20000, firstMonth: "2026-12", payerSharePct: 100 },
  { ...base, id: "outro", description: "Outro cartão", totalCents: 99900, firstMonth: "2026-12", cardId: "c2" },
];

describe("insights do cartão", () => {
  const s = cardInsights(purchases, "c1", "2026-12", members, new Set(["show"]));

  it("total e composição da fatura", () => {
    expect(s.totalCents).toBe(40000 + 30000 + 20000 + 5590 + 20000);
    expect(s.composition).toEqual({ avistaCents: 60000, parceladoCents: 50000, assinaturaCents: 5590 });
    expect(s.lines.map((l) => l.sourceId)).not.toContain("outro");
  });

  it("de quem é cada parte (amigos à parte)", () => {
    // mercado 20k/20k, TV 15k/15k, tênis 0/20k, netflix 5590/0, show -> amigos
    expect(s.byPerson).toEqual({ ana: 20000 + 15000 + 5590, joao: 20000 + 15000 + 20000, friends: 20000 });
  });

  it("comparação com o mês anterior e média", () => {
    // nov: TV 30k + tênis 20k + netflix 5590
    expect(s.prevTotalCents).toBe(55590);
    expect(s.changePct).toBeCloseTo(((115590 - 55590) / 55590) * 100, 0);
    expect(s.timeline).toHaveLength(12);
    expect(s.timeline[5]).toEqual({ ym: "2026-12", totalCents: 115590 });
  });

  it("assinaturas, parcelamentos em aberto e próximo alívio", () => {
    expect(s.subscriptionsMonthlyCents).toBe(5590);
    expect(s.openInstallments.map((x) => [x.description, x.remainingCount, x.remainingCents])).toEqual([
      ["TV", 7, 210000],
      ["Tênis", 1, 20000],
    ]);
    expect(s.committedCents).toBe(230000);
    // o tênis acaba em jan/27: a fatura de fev/27 cai R$ 200
    expect(s.nextRelief).toEqual({ ym: "2027-02", cents: 20000, descriptions: ["Tênis"] });
  });
});

describe("excluir a fatura do cartão", () => {
  it("leva as compras com parcela na fatura, inclusive as parceladas", () => {
    const r = invoicePurchases(purchases, "c1", "2026-12");
    expect(r.remove.map((p) => p.id).sort()).toEqual(["mercado", "show", "tenis", "tv"]);
  });
  it("mantém assinaturas que começaram antes e não mexe em outro cartão", () => {
    const r = invoicePurchases(purchases, "c1", "2026-12");
    expect(r.keptSubscriptions.map((p) => p.id)).toEqual(["netflix"]);
    expect(r.remove.some((p) => p.cardId === "c2")).toBe(false);
  });
  it("apaga a assinatura que começou nesta fatura", () => {
    expect(invoicePurchases(purchases, "c1", "2026-06").remove.map((p) => p.id)).toEqual(["netflix"]);
  });
  it("fatura vazia não apaga nada", () => {
    expect(invoicePurchases(purchases, "c1", "2026-01")).toEqual({ remove: [], keptSubscriptions: [] });
  });
});
