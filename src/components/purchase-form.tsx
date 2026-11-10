"use client";

import { useActionState, useState } from "react";
import { savePurchase } from "@/app/actions";
import { formatBRL, invoiceMonthFor, parseBRL, splitInstallments } from "@/lib/ledger";
import { Message, Submit } from "./form-bits";

type Member = { id: string; name: string };
export type CardOption = { id: string; name: string; ownerId: string; closingDay: number; dueDay: number };

export interface PurchaseDefaults {
  id?: string;
  description?: string;
  category?: string | null;
  total?: string;
  installments?: number;
  firstMonth: string;
  purchaseDate: string;
  paidById: string;
  payerSharePct?: number;
  cardId?: string | null;
}

export function PurchaseForm({
  members,
  defaults,
  cards = [],
}: {
  members: Member[];
  defaults: PurchaseDefaults;
  cards?: CardOption[];
}) {
  const [state, action] = useActionState(savePurchase, undefined);
  const [paidById, setPaidById] = useState(defaults.paidById);
  const [cardId, setCardId] = useState(defaults.cardId ?? "");
  const [purchaseDate, setPurchaseDate] = useState(defaults.purchaseDate);
  const [firstMonth, setFirstMonth] = useState(defaults.firstMonth);

  const card = cards.find((c) => c.id === cardId);
  const suggestMonth = (c: CardOption | undefined, date: string) => {
    if (c && /^\d{4}-\d{2}-\d{2}$/.test(date)) setFirstMonth(invoiceMonthFor(date, c.closingDay, c.dueDay));
  };
  const chooseCard = (id: string) => {
    setCardId(id);
    const c = cards.find((x) => x.id === id);
    if (c) {
      setPaidById(c.ownerId);
      suggestMonth(c, purchaseDate);
    }
  };
  const choosePayer = (id: string) => {
    setPaidById(id);
    if (card && card.ownerId !== id) setCardId("");
  };
  const [pct, setPct] = useState(defaults.payerSharePct ?? 50);
  const [total, setTotal] = useState(defaults.total ?? "");
  const [installments, setInstallments] = useState(defaults.installments ?? 1);

  const payer = members.find((m) => m.id === paidById)!;
  const other = members.find((m) => m.id !== paidById)!;

  const mode = pct === 50 ? "split" : pct === 100 ? "payer" : pct === 0 ? "other" : "custom";
  const cents = parseBRL(total) ?? 0;
  const firstInstallment = cents && installments > 0 ? splitInstallments(cents, installments)[0] : 0;
  const owedPerInstallment = Math.round((firstInstallment * (100 - pct)) / 100);

  const chip = (active: boolean) =>
    `rounded-xl border px-3 py-2.5 text-left transition text-sm ${
      active ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 ring-4 ring-blue-500/10 dark:bg-blue-950 dark:text-blue-300" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    }`;

  return (
    <form action={action} className="card space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Descrição</label>
          <input className="input" id="description" name="description" required defaultValue={defaults.description} placeholder="Ex: Geladeira, mercado, tênis…" />
        </div>
        <div>
          <label className="label" htmlFor="total">Valor total (R$)</label>
          <input className="input" id="total" name="total" required inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="1.200,00" />
        </div>
        <div>
          <label className="label" htmlFor="installments">Parcelas</label>
          <input className="input" id="installments" name="installments" type="number" min={1} max={72} required value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 1)} />
        </div>
        <div>
          <label className="label" htmlFor="purchaseDate">Data da compra</label>
          <input
            className="input" id="purchaseDate" name="purchaseDate" type="date" required value={purchaseDate}
            onChange={(e) => { setPurchaseDate(e.target.value); suggestMonth(card, e.target.value); }}
          />
        </div>
        <div>
          <label className="label" htmlFor="firstMonth">Mês da 1ª parcela (fatura)</label>
          <input className="input" id="firstMonth" name="firstMonth" type="month" required value={firstMonth} onChange={(e) => setFirstMonth(e.target.value)} />
          {card && <p className="mt-1 text-[11px] text-zinc-500">Sugerido pelo fechamento (dia {card.closingDay}) do {card.name}.</p>}
        </div>
        {cards.length > 0 && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cardId">Cartão (opcional)</label>
            <select className="input" id="cardId" name="cardId" value={cardId} onChange={(e) => chooseCard(e.target.value)}>
              <option value="">Sem cartão (Pix, débito, dinheiro…)</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {members.find((m) => m.id === c.ownerId)?.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="category">Categoria (opcional)</label>
          <input className="input" id="category" name="category" defaultValue={defaults.category ?? ""} placeholder="Casa, mercado, roupas…" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Quem pagou? (cartão / conta usada)</legend>
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <label key={m.id} className={`cursor-pointer ${chip(paidById === m.id)}`}>
              <input type="radio" name="paidById" value={m.id} checked={paidById === m.id} onChange={() => choosePayer(m.id)} className="sr-only" />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">De quem é a compra?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" className={chip(mode === "split")} onClick={() => setPct(50)}>Dividida 50/50</button>
          <button type="button" className={chip(mode === "payer")} onClick={() => setPct(100)}>Só de {payer.name}</button>
          <button type="button" className={chip(mode === "other")} onClick={() => setPct(0)}>Só de {other.name}</button>
          <button type="button" className={chip(mode === "custom")} onClick={() => mode !== "custom" && setPct(60)}>Personalizado</button>
        </div>
        {mode === "custom" && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="w-28 truncate">{payer.name}: {pct}%</span>
            <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="flex-1 accent-blue-600" />
            <span className="w-28 truncate text-right">{other.name}: {100 - pct}%</span>
          </div>
        )}
        <input type="hidden" name="payerSharePct" value={pct} />
      </fieldset>

      {cents > 0 && (
        <p className="rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
          {installments > 1 && `${installments}x de ~${formatBRL(firstInstallment)}. `}
          {owedPerInstallment > 0 ? (
            <>
              <b>{other.name}</b> deve <b>{formatBRL(owedPerInstallment)}</b>
              {installments > 1 && " por mês"} a <b>{payer.name}</b>.
            </>
          ) : (
            <>Não gera dívida: é toda de {payer.name}.</>
          )}
        </p>
      )}

      <Message state={state} />
      <Submit className="btn w-full sm:w-auto">{defaults.id ? "Salvar alterações" : "Adicionar compra"}</Submit>
    </form>
  );
}
