"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addSettlement } from "@/app/actions";
import { IconCheck } from "./icons";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-outline shrink-0" disabled={pending}>
      <IconCheck width={14} height={14} /> {pending ? "Salvando…" : "Marcar feito"}
    </button>
  );
}

/** Registra de uma vez a transferência sugerida (valor pendente do mês). */
export function QuickSettle({ month, fromId, amount }: { month: string; fromId: string; amount: string }) {
  const [state, action] = useActionState(addSettlement, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="fromId" value={fromId} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="note" value="Pix" />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      <Btn />
    </form>
  );
}
