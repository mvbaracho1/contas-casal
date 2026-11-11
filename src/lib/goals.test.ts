import { describe, expect, it } from "vitest";
import { emergencyFundSuggestion, summarizeGoal } from "./goals";

const members = ["ana", "joao"];

describe("metas", () => {
  it("progresso, quanto falta e quanto guardar por mês", () => {
    const s = summarizeGoal({ targetCents: 1200000, targetMonth: "2027-06" }, [
      { userId: "ana", amountCents: 200000 },
      { userId: "joao", amountCents: 100000 },
    ], "2026-11", members);
    expect(s).toMatchObject({ savedCents: 300000, remainingCents: 900000, pct: 25, monthsLeft: 8, monthlyCents: 112500, status: "andamento" });
    expect(s.byMember).toEqual({ ana: 200000, joao: 100000 });
  });

  it("retirada diminui o guardado", () => {
    const s = summarizeGoal({ targetCents: 100000, targetMonth: null }, [
      { userId: "ana", amountCents: 80000 },
      { userId: "ana", amountCents: -30000 },
    ], "2026-11", members);
    expect(s).toMatchObject({ savedCents: 50000, remainingCents: 50000, monthsLeft: null, monthlyCents: null });
    expect(s.byMember.ana).toBe(50000);
  });

  it("concluída e atrasada", () => {
    expect(summarizeGoal({ targetCents: 1000, targetMonth: "2026-01" }, [{ userId: "ana", amountCents: 1500 }], "2026-11", members)).toMatchObject({
      status: "concluida", pct: 100, remainingCents: 0, monthlyCents: null,
    });
    expect(summarizeGoal({ targetCents: 1000, targetMonth: "2026-10" }, [], "2026-11", members)).toMatchObject({
      status: "atrasada", monthsLeft: 0, monthlyCents: 1000,
    });
  });

  it("prazo no mês atual conta como 1 mês", () => {
    expect(summarizeGoal({ targetCents: 1000, targetMonth: "2026-11" }, [], "2026-11", members).monthlyCents).toBe(1000);
  });

  it("reserva de emergência = 6 meses de contas fixas", () => {
    expect(emergencyFundSuggestion(500000)).toBe(3000000);
  });
});
