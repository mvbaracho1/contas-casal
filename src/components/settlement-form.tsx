"use client";

import { useActionState } from "react";
import { addSettlement } from "@/app/actions";
import { Message, Submit } from "./form-bits";

type Member = { id: string; name: string };

export function SettlementForm({
  month,
  members,
  suggestedFromId,
  suggestedAmount,
}: {
  month: string;
  members: Member[];
  suggestedFromId?: string;
  suggestedAmount?: string;
}) {
  const [state, action] = useActionState(addSettlement, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fromId">Quem enviou</label>
          <select className="input" id="fromId" name="fromId" defaultValue={suggestedFromId ?? members[0].id}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Valor (R$)</label>
          <input className="input" id="amount" name="amount" inputMode="decimal" required defaultValue={suggestedAmount} key={suggestedAmount} />
        </div>
        <div>
          <label className="label" htmlFor="note">Obs. (opcional)</label>
          <input className="input" id="note" name="note" placeholder="Pix, dinheiro…" />
        </div>
      </div>
      <Message state={state} />
      <Submit className="btn w-full sm:w-auto">Registrar transferência</Submit>
    </form>
  );
}
