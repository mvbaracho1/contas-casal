"use client";

import { useActionState, useState } from "react";
import { resetCoupleData } from "@/app/actions-reset";
import { ConfirmButton } from "./confirm-button";
import { Message } from "./form-bits";

export type ResetPart = { key: string; label: string; emoji: string; count: number; hint?: string };

export function ResetDataForm({ parts }: { parts: ResetPart[] }) {
  const [state, action] = useActionState(resetCoupleData, undefined);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(parts.map((p) => [p.key, true])));
  const chosen = parts.filter((p) => selected[p.key]);
  const total = chosen.reduce((a, p) => a + p.count, 0);
  const all = chosen.length === parts.length;

  return (
    <form action={action} className="space-y-4">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {parts.map((p) => (
          <li key={p.key}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="checkbox" name="parts" value={p.key} className="size-4 accent-red-600"
                checked={Boolean(selected[p.key])} onChange={(e) => setSelected((s) => ({ ...s, [p.key]: e.target.checked }))}
              />
              <span className="text-lg" aria-hidden>{p.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.label}</span>
                {p.hint && <span className="muted block text-[11px]">{p.hint}</span>}
              </span>
              <span className="tabular muted text-xs">{p.count}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 text-xs">
        <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setSelected(Object.fromEntries(parts.map((p) => [p.key, true])))}>Marcar tudo</button>
        <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setSelected({})}>Desmarcar tudo</button>
      </div>

      <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
        {total === 1 ? "Será apagado" : "Serão apagados"} <b>{total} {total === 1 ? "registro" : "registros"}</b> para vocês dois. <b>Não dá para desfazer.</b> As contas de vocês e o casal continuam.
      </p>

      <Message state={state} />
      <ConfirmButton
        className="btn w-full bg-red-600 shadow-red-600/20 hover:bg-red-700 disabled:opacity-40"
        disabled={chosen.length === 0}
        title={all ? "Apagar todos os dados?" : "Apagar os dados marcados?"}
        message={
          <>
            {chosen.map((p) => p.label).join(", ")}: <b>{total} {total === 1 ? "registro" : "registros"}</b> {total === 1 ? "será apagado" : "serão apagados"} para vocês dois. Não dá para desfazer.
          </>
        }
        confirmLabel={all ? "Apagar tudo" : "Apagar"}
        requireText="APAGAR"
        requireName="confirm"
      >
        {chosen.length === 0 ? "Marque o que apagar" : all ? "Apagar tudo…" : "Apagar o que está marcado…"}
      </ConfirmButton>
    </form>
  );
}
