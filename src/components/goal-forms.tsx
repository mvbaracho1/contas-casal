"use client";

import { useActionState, useEffect, useState } from "react";
import { addGoalEntry, saveGoal } from "@/app/actions-goals";
import { GOAL_EMOJIS, GOAL_TEMPLATES } from "@/lib/goals";
import { formatBRL, parseBRL } from "@/lib/ledger";
import { Message, Submit } from "./form-bits";
import { ParamLink } from "./url-state";

type Member = { id: string; name: string };

const chip = (active: boolean) =>
  `rounded-xl border px-3 py-2 text-sm transition ${
    active
      ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 ring-4 ring-blue-500/10 dark:bg-blue-950 dark:text-blue-300"
      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
  }`;
const toInput = (c?: number | null) => (c ? (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

export interface GoalDefaults {
  id?: string;
  name?: string;
  emoji?: string;
  targetCents?: number;
  targetMonth?: string | null;
  note?: string | null;
}

export function GoalForm({ defaults, emergencyCents }: { defaults: GoalDefaults; emergencyCents: number }) {
  const [state, action] = useActionState(saveGoal, undefined);
  const [name, setName] = useState(defaults.name ?? "");
  const [emoji, setEmoji] = useState(defaults.emoji ?? "🎯");
  const [target, setTarget] = useState(toInput(defaults.targetCents));
  const [month, setMonth] = useState(defaults.targetMonth ?? "");
  const editing = Boolean(defaults.id);

  const cents = parseBRL(target) ?? 0;
  const monthsLeft = month ? Math.max(1, (Number(month.slice(0, 4)) - new Date().getFullYear()) * 12 + Number(month.slice(5)) - (new Date().getMonth() + 1) + 1) : 0;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title">{editing ? "Editar meta" : "Nova meta"}</h2>
        {editing && <ParamLink param="ver" value={defaults.id!} clear={["editar"]} className="text-xs font-medium text-blue-600">Cancelar</ParamLink>}
      </div>

      {!editing && (
        <div>
          <p className="label">Comece por um modelo</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_TEMPLATES.map((t) => (
              <button
                key={t.emoji + t.name}
                type="button"
                className={chip(emoji === t.emoji && name === t.name)}
                onClick={() => {
                  setEmoji(t.emoji);
                  setName(t.name);
                  if (t.name === "Reserva de emergência" && emergencyCents > 0 && !target) setTarget(toInput(emergencyCents));
                }}
              >
                {t.emoji} {t.name || "Outra"}
              </button>
            ))}
          </div>
        </div>
      )}

      <form action={action} className="space-y-4">
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        <input type="hidden" name="emoji" value={emoji} />
        <div>
          <label className="label" htmlFor="goal-name">Nome da meta</label>
          <input className="input" id="goal-name" name="name" required maxLength={60} placeholder="Ex: Viagem para o Chile" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <span className="label">Ícone</span>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_EMOJIS.map((e) => (
              <button
                key={e} type="button" aria-label={`Ícone ${e}`} aria-pressed={emoji === e} onClick={() => setEmoji(e)}
                className={`flex size-9 items-center justify-center rounded-xl text-lg transition ${emoji === e ? "bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-950" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="goal-target">Quanto juntar (R$)</label>
            <input className="input" id="goal-target" name="target" required inputMode="decimal" placeholder="10.000,00" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="goal-month">Até quando (opcional)</label>
            <input className="input" id="goal-month" name="targetMonth" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>
        {name === "Reserva de emergência" && emergencyCents > 0 && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
            Sugestão: 6 meses das contas fixas de vocês = <b>{formatBRL(emergencyCents)}</b>.{" "}
            <button type="button" className="font-semibold underline" onClick={() => setTarget(toInput(emergencyCents))}>Usar esse valor</button>
          </p>
        )}
        {cents > 0 && monthsLeft > 0 && (
          <p className="muted text-xs">
            Para chegar lá, guardem cerca de <b className="text-zinc-700 dark:text-zinc-200">{formatBRL(Math.ceil(cents / monthsLeft))}</b> por mês ({monthsLeft} {monthsLeft === 1 ? "mês" : "meses"}).
          </p>
        )}
        <div>
          <label className="label" htmlFor="goal-note">Observação (opcional)</label>
          <input className="input" id="goal-note" name="note" maxLength={300} placeholder="Ex: guardar no CDB do banco X" defaultValue={defaults.note ?? ""} />
        </div>
        <Message state={state} />
        <Submit className="btn w-full">{editing ? "Salvar meta" : "Criar meta"}</Submit>
      </form>
    </div>
  );
}

export function GoalEntryForm({ goalId, members, meId, suggestedCents, savedCents }: {
  goalId: string;
  members: Member[];
  meId: string;
  suggestedCents: number;
  savedCents: number;
}) {
  const [state, action] = useActionState(addGoalEntry, undefined);
  const [kind, setKind] = useState<"aporte" | "retirada">("aporte");
  const [userId, setUserId] = useState(meId);
  const [amount, setAmount] = useState(toInput(suggestedCents));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  // depois de registrar, volta para a sugestão (a mensagem de sucesso vem no toast)
  useEffect(() => {
    if (state && !state.error) {
      setAmount(toInput(suggestedCents));
      setKind("aporte");
    }
  }, [state, suggestedCents]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {(["aporte", "retirada"] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => setKind(k)} disabled={k === "retirada" && savedCents <= 0}
            className={`rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-40 ${kind === k ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500"}`}
          >
            {k === "aporte" ? "Guardar" : "Retirar"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {members.map((m) => (
          <button key={m.id} type="button" className={chip(userId === m.id)} onClick={() => setUserId(m.id)}>
            {m.id === meId ? "Eu" : m.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="entry-amount">Valor</label>
          <input className="input" id="entry-amount" name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="entry-date">Data</label>
          <input className="input" id="entry-date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <Message state={state} />
      <Submit className={`btn w-full ${kind === "retirada" ? "bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700" : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"}`}>
        {kind === "aporte" ? "Registrar aporte" : "Registrar retirada"}
      </Submit>
    </form>
  );
}
