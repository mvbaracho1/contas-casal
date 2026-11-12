"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { openDispute, resolveDispute } from "@/app/actions-disputes";
import { Message, Submit } from "./form-bits";

export type ProposalOption = { value: "100" | "50" | "renda"; label: string };

/** Botão "Contestar" que abre, ali mesmo, a escolha da nova divisão e o campo da justificativa. */
export function DisputeOpen({ kind, sourceId, month, payerName, options, hint }: {
  kind: "purchase" | "bill";
  sourceId: string;
  month: string;
  /** quem pagou (vai responder) */
  payerName: string;
  /** divisões que dá para propor (sem a atual) */
  options: ProposalOption[];
  /** onde a nova divisão vale se for aceita */
  hint: string;
}) {
  const [state, action] = useActionState(openDispute, undefined);
  const [open, setOpen] = useState(false);
  // o React limpa o formulário depois do envio: texto e escolha ficam no estado para não perder em caso de erro
  const [reason, setReason] = useState("");
  const [proposal, setProposal] = useState(options[0]?.value ?? "100");

  useEffect(() => {
    if (state && !state.error) {
      setOpen(false);
      setReason("");
    }
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-400">
        Contestar
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="proposal" value={proposal} />
      <fieldset>
        <legend className="label">Qual divisão você propõe?</legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={proposal === o.value}
              onClick={() => setProposal(o.value)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                proposal === o.value
                  ? "border-amber-500 bg-white font-semibold text-amber-800 ring-2 ring-amber-500/15 dark:bg-zinc-900 dark:text-amber-300"
                  : "border-zinc-200 bg-white/60 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="label" htmlFor={`motivo-${sourceId}`}>Por que você contesta?</label>
      <textarea
        id={`motivo-${sourceId}`} name="reason" required rows={2} maxLength={500} autoFocus
        className="input min-h-16 resize-y text-sm" placeholder="Ex.: essa compra foi só sua / combinamos dividir pela renda"
        value={reason} onChange={(e) => setReason(e.target.value)}
      />
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{payerName} vai aceitar ou recusar. {hint}</p>
      <Message state={state?.error ? state : undefined} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>Cancelar</button>
        <Submit className="btn bg-amber-600 px-3 py-1.5 text-xs shadow-amber-600/20 hover:bg-amber-700">Enviar contestação</Submit>
      </div>
    </form>
  );
}

/** Botão de decisão: grava a escolha no campo oculto antes de enviar (o valor do botão nem sempre vai no envio). */
function Decision({ value, field, children, className }: {
  value: string;
  field: React.RefObject<HTMLInputElement | null>;
  children: React.ReactNode;
  className: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("decision") === value;
  return (
    <button type="submit" className={className} disabled={pending} onClick={() => field.current && (field.current.value = value)}>
      {mine ? "Salvando…" : children}
    </button>
  );
}

/** Quem pagou responde: aceita (sai do acerto) ou recusa (com explicação). */
export function DisputeResolve({ id, hint }: { id: string; hint: string }) {
  const [state, action] = useActionState(resolveDispute, undefined);
  const [response, setResponse] = useState("");
  const decision = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" ref={decision} defaultValue="" />
      <textarea
        name="response" rows={2} maxLength={500} aria-label="Sua resposta"
        className="input min-h-14 resize-y text-sm" placeholder="Resposta (obrigatória para recusar)"
        value={response} onChange={(e) => setResponse(e.target.value)}
      />
      <Message state={state?.error ? state : undefined} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
        <div className="flex gap-2">
          <Decision value="recusar" field={decision} className="btn-outline px-3 py-1.5 text-xs">Recusar</Decision>
          <Decision value="aceitar" field={decision} className="btn bg-emerald-600 px-3 py-1.5 text-xs shadow-emerald-600/20 hover:bg-emerald-700">Aceitar</Decision>
        </div>
      </div>
    </form>
  );
}
