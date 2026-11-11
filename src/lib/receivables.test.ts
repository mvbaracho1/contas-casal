import { describe, expect, it } from "vitest";
import { chargeMessage, summarizeReceivable, whatsappLink } from "./receivables";

const base = { personName: "Pedro Souza", description: "Show no cartão", totalCents: 30000, installments: 3, startInstallment: 1, firstMonth: "2026-10" };

describe("valores a receber", () => {
  it("sem pagamento: vencida, deste mês e a vencer", () => {
    const s = summarizeReceivable(base, [], "2026-11");
    expect(s.rows.map((r) => r.status)).toEqual(["vencido", "este-mes", "a-vencer"]);
    expect(s).toMatchObject({ owedCents: 30000, paidCents: 0, overdueCents: 10000, dueNowCents: 20000, status: "atrasado" });
    expect(s.next?.number).toBe(1);
  });

  it("pagamento parcial vai para a parcela mais antiga", () => {
    const s = summarizeReceivable(base, [{ amountCents: 15000 }], "2026-11");
    expect(s.rows.map((r) => [r.status, r.paidCents])).toEqual([["pago", 10000], ["parcial", 5000], ["a-vencer", 0]]);
    expect(s).toMatchObject({ remainingCents: 15000, overdueCents: 0, dueNowCents: 5000, status: "em-dia" });
  });

  it("quitado", () => {
    const s = summarizeReceivable(base, [{ amountCents: 20000 }, { amountCents: 10000 }], "2026-10");
    expect(s.status).toBe("quitado");
    expect(s.next).toBeNull();
  });

  it("conta só a partir da parcela inicial", () => {
    const s = summarizeReceivable({ ...base, totalCents: 100000, installments: 10, startInstallment: 3 }, [], "2026-12");
    expect(s.rows[0]).toMatchObject({ number: 3, month: "2026-12", amountCents: 10000, status: "este-mes" });
    expect(s.owedCents).toBe(80000);
  });

  it("mensagem de cobrança", () => {
    const s = summarizeReceivable(base, [], "2026-11");
    const msg = chargeMessage(base, s);
    expect(msg).toContain("Oi, Pedro!");
    expect(msg).toContain("parcela 1/3");
    expect(msg).toContain("Total que falta");
    expect(whatsappLink(msg)).toMatch(/^https:\/\/wa\.me\/\?text=Oi%2C%20Pedro/);
  });
});
