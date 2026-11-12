"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { addReceivablePayment, saveReceivable } from "@/app/actions-receivables";
import { formatBRL, parseBRL, splitInstallments } from "@/lib/ledger";
import { CopyButton } from "./couple-forms";
import { Message, Submit } from "./form-bits";

type Member = { id: string; name: string };

const chip = (active: boolean) =>
  `rounded-xl border px-3 py-2.5 text-left text-sm transition ${
    active
      ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 ring-4 ring-blue-500/10 dark:bg-blue-950 dark:text-blue-300"
      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
  }`;

export interface ReceivableDefaults {
  id?: string;
  personName?: string;
  description?: string;
  totalCents?: number;
  installments?: number;
  firstMonth: string;
  creditorId: string;
  note?: string | null;
  /** ligado a uma compra: valores vêm dela e não podem ser editados aqui */
  linkedPurchaseId?: string | null;
}

/** Formulário em página própria: `cancelHref` volta para a lista ou para o valor. */
export function ReceivableForm({ members, people, defaults, cancelHref }: { members: Member[]; people: string[]; defaults: ReceivableDefaults; cancelHref: string }) {
  const [state, action] = useActionState(saveReceivable, undefined);
  const [creditorId, setCreditorId] = useState(defaults.creditorId);
  const [total, setTotal] = useState(defaults.totalCents ? (defaults.totalCents / 100).toFixed(2).replace(".", ",") : "");
  const [installments, setInstallments] = useState(defaults.installments ?? 1);
  const linked = Boolean(defaults.linkedPurchaseId);
  const cents = parseBRL(total) ?? 0;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title">{defaults.id ? "Editar valor a receber" : "Novo valor a receber"}</h2>
        <Link href={cancelHref} className="text-xs font-medium text-blue-600">Cancelar</Link>
      </div>
      <form action={action} className="space-y-4">
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label" htmlFor="personName">Quem deve</label>
            <input className="input" id="personName" name="personName" required list="people" autoComplete="off" placeholder="Nome do amigo ou parente" defaultValue={defaults.personName} />
            <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="description">Do quê</label>
            <input className="input" id="description" name="description" required placeholder="Ex: ingresso do show, passagem…" defaultValue={defaults.description} />
          </div>
          {linked ? (
            <p className="col-span-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
              Valor e parcelas vêm da compra no cartão.{" "}
              <Link href={`/compras/${defaults.linkedPurchaseId}`} className="font-semibold underline">Editar a compra</Link>
            </p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="total">Valor total (R$)</label>
                <input className="input" id="total" name="total" required inputMode="decimal" placeholder="300,00" value={total} onChange={(e) => setTotal(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="installments">Parcelas</label>
                <input className="input" id="installments" name="installments" type="number" min={1} max={72} required value={installments} onChange={(e) => setInstallments(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="firstMonth">{installments > 1 ? "Mês da 1ª parcela" : "Mês para receber"}</label>
                <input className="input" id="firstMonth" name="firstMonth" type="month" required defaultValue={defaults.firstMonth} />
                {cents > 0 && installments > 1 && (
                  <p className="mt-1 text-[11px] text-zinc-500">{installments}x de ~{formatBRL(splitInstallments(cents, installments)[0])}</p>
                )}
              </div>
            </>
          )}
        </div>

        {!linked && (
          <fieldset>
            <legend className="label">Quem recebe</legend>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m) => (
                <label key={m.id} className={`cursor-pointer ${chip(creditorId === m.id)}`}>
                  <input type="radio" name="creditorId" value={m.id} checked={creditorId === m.id} onChange={() => setCreditorId(m.id)} className="sr-only" />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {linked && <input type="hidden" name="creditorId" value={creditorId} />}

        <div>
          <label className="label" htmlFor="note">Observação (opcional)</label>
          <input className="input" id="note" name="note" placeholder="Ex: combinou de pagar por Pix" defaultValue={defaults.note ?? ""} />
        </div>
        <Message state={state} />
        <Submit className="btn w-full sm:w-auto">{defaults.id ? "Salvar" : "Adicionar"}</Submit>
      </form>
    </div>
  );
}

export function PaymentForm({ receivableId, suggestedCents }: { receivableId: string; suggestedCents: number }) {
  const [state, action] = useActionState(addReceivablePayment, undefined);
  const fmt = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
  const [amount, setAmount] = useState(fmt(suggestedCents));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Depois de registrar, sugere o próximo valor em aberto (mantendo a mensagem de sucesso).
  useEffect(() => {
    if (state && !state.error) setAmount(fmt(suggestedCents));
  }, [state, suggestedCents]);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="receivableId" value={receivableId} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="pay-amount">Valor recebido</label>
          <input className="input" id="pay-amount" name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pay-date">Data</label>
          <input className="input" id="pay-date" name="paidAt" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <Message state={state} />
      <Submit className="btn w-full">Registrar recebimento</Submit>
    </form>
  );
}

export function ChargeButtons({ message, whatsapp }: { message: string; whatsapp: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn flex-1 bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700">
        Cobrar no WhatsApp
      </a>
      <CopyButton text={message} label="Copiar mensagem" />
    </div>
  );
}
