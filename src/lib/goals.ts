// Metas do casal: progresso, quanto guardar por mês e quem contribuiu. Lógica pura (testada).

import { ymToIndex, type Ym } from "./ledger";

export interface GoalLike {
  targetCents: number;
  /** "YYYY-MM" ou null (sem prazo) */
  targetMonth: Ym | null;
}

export interface GoalEntryLike {
  userId: string;
  /** positivo = aporte, negativo = retirada */
  amountCents: number;
}

export type GoalStatus = "concluida" | "atrasada" | "andamento";

export interface GoalSummary {
  savedCents: number;
  remainingCents: number;
  /** 0–100 */
  pct: number;
  /** Meses até o prazo, contando o atual (null = sem prazo; 0 = prazo passou) */
  monthsLeft: number | null;
  /** Quanto guardar por mês para chegar no prazo (null = sem prazo ou já concluída) */
  monthlyCents: number | null;
  /** Saldo de aportes de cada pessoa */
  byMember: Record<string, number>;
  status: GoalStatus;
}

export function summarizeGoal(goal: GoalLike, entries: GoalEntryLike[], today: Ym, memberIds: string[]): GoalSummary {
  const byMember: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  let total = 0;
  for (const e of entries) {
    total += e.amountCents;
    byMember[e.userId] = (byMember[e.userId] ?? 0) + e.amountCents;
  }
  const savedCents = Math.max(0, total);
  const remainingCents = Math.max(0, goal.targetCents - savedCents);
  const pct = goal.targetCents > 0 ? Math.min(100, Math.round((savedCents / goal.targetCents) * 1000) / 10) : 0;
  const monthsLeft = goal.targetMonth ? Math.max(0, ymToIndex(goal.targetMonth) - ymToIndex(today) + 1) : null;
  const done = remainingCents === 0;
  const monthlyCents = done || monthsLeft === null ? null : monthsLeft > 0 ? Math.ceil(remainingCents / monthsLeft) : remainingCents;
  const status: GoalStatus = done ? "concluida" : monthsLeft === 0 ? "atrasada" : "andamento";
  return { savedCents, remainingCents, pct, monthsLeft, monthlyCents, byMember, status };
}

/** Sugestão de reserva de emergência: N meses do custo fixo mensal do casal. */
export function emergencyFundSuggestion(monthlyFixedCents: number, months = 6) {
  return monthlyFixedCents * months;
}

/** Modelos para criar uma meta rápido. */
export const GOAL_TEMPLATES = [
  { emoji: "✈️", name: "Viagem" },
  { emoji: "🛟", name: "Reserva de emergência" },
  { emoji: "🏠", name: "Casa própria" },
  { emoji: "🚗", name: "Carro" },
  { emoji: "💍", name: "Casamento" },
  { emoji: "🎓", name: "Estudos" },
  { emoji: "👶", name: "Bebê" },
  { emoji: "🎯", name: "" },
] as const;

export const GOAL_EMOJIS = ["🎯", "✈️", "🛟", "🏠", "🚗", "💍", "🎓", "👶", "🐶", "💻", "🛋️", "🎉", "🏖️", "💰"] as const;
