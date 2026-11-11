"use client";

import { useActionState, useState } from "react";
import { savePurchase } from "@/app/actions";
import { addMonths, formatBRL, invoiceMonthFor, parseBRL, splitInstallments } from "@/lib/ledger";
import { Message, Submit } from "./form-bits";

type Member = { id: string; name: string };
export type CardOption = { id: string; name: string; ownerId: string; closingDay: number; dueDay: number };

export interface PurchaseDefaults {
  id?: string;
  description?: string;
  category?: string | null;
  total?: string;
  installments?: number;
  startInstallment?: number;
  firstMonth: string;
  purchaseDate: string;
  paidById: string;
  /** null = proporcional à renda */
  payerSharePct?: number | null;
  cardId?: string | null;
}

export function PurchaseForm({
  members,
  defaults,
  cards = [],
  incomePct = null,
}: {
  members: Member[];
  defaults: PurchaseDefaults;
  cards?: CardOption[];
  /** % da renda de cada um no mês; null se ninguém cadastrou renda */
  incomePct?: Record<string, number> | null;
}) {
  const [state, action] = useActionState(savePurchase, undefined);
  const [paidById, setPaidById] = useState(defaults.paidById);
  const [cardId, setCardId] = useState(defaults.cardId ?? "");
  const [purchaseDate, setPurchaseDate] = useState(defaults.purchaseDate);
  // O mês mostrado é o da parcela inicial; o enviado (firstMonth) é sempre o da 1ª parcela.
  const [startInstallment, setStartInstallment] = useState(defaults.startInstallment ?? 1);
  const [startMonth, setStartMonth] = useState(addMonths(defaults.firstMonth, (defaults.startInstallment ?? 1) - 1));

  const card = cards.find((c) => c.id === cardId);
  const suggestMonth = (c: CardOption | undefined, date: string) => {
    if (c && /^\d{4}-\d{2}-\d{2}$/.test(date)) setStartMonth(addMonths(invoiceMonthFor(date, c.closingDay, c.dueDay), start - 1));
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
  const [pct, setPct] = useState<number | null>(defaults.payerSharePct === undefined ? 50 : defaults.payerSharePct);
  const [total, setTotal] = useState(defaults.total ?? "");
  const [installments, setInstallments] = useState(defaults.installments ?? 1);
  const start = installments > 1 ? Math.min(startInstallment, installments) : 1;
  const firstMonth = /^\d{4}-\d{2}$/.test(startMonth) ? addMonths(startMonth, -(start - 1)) : startMonth;

  const payer = members.find((m) => m.id === paidById)!;
  const other = members.find((m) => m.id !== paidById)!;

  const mode = pct === null ? "renda" : pct === 50 ? "split" : pct === 100 ? "payer" : pct === 0 ? "other" : "custom";
  const cents = parseBRL(total) ?? 0;
  const firstInstallment = cents && installments > 0 ? splitInstallments(cents, installments)[0] : 0;
  const otherPct = pct === null ? (incomePct?.[other.id] ?? 50) : 100 - pct;
  const owedPerInstallment = Math.round((firstInstallment * otherPct) / 100);

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
          <label className="label" htmlFor="startMonth">{start > 1 ? `Fatura da parcela ${start}` : "Mês da 1ª parcela (fatura)"}</label>
          <input className="input" id="startMonth" type="month" required value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          <input type="hidden" name="firstMonth" value={firstMonth} />
          {card && <p className="mt-1 text-[11px] text-zinc-500">Sugerido pelo fechamento (dia {card.closingDay}) do {card.name}.</p>}
        </div>
        {installments > 1 && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="startInstallment">Começar a contar da parcela</label>
            <input
              className="input" id="startInstallment" name="startInstallment" type="number" min={1} max={installments} required
              value={startInstallment} onChange={(e) => setStartInstallment(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              {start > 1
                ? `As parcelas 1 a ${start - 1} ficam de fora das contas (já foram pagas antes).`
                : "Use quando a compra é antiga e já está, por exemplo, na parcela 3."}
            </p>
          </div>
        )}
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
          <button type="button" className={`col-span-2 sm:col-span-4 ${chip(mode === "renda")}`} onClick={() => setPct(null)}>
            Proporcional à renda
            <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {incomePct
                ? `${payer.name} ${incomePct[payer.id]}% · ${other.name} ${incomePct[other.id]}% (renda deste mês)`
                : "Cadastre a renda em “Nossa renda”. Sem renda, fica 50/50."}
            </span>
          </button>
          <button type="button" className={chip(mode === "split")} onClick={() => setPct(50)}>Dividida 50/50</button>
          <button type="button" className={chip(mode === "payer")} onClick={() => setPct(100)}>Só de {payer.name}</button>
          <button type="button" className={chip(mode === "other")} onClick={() => setPct(0)}>Só de {other.name}</button>
          <button type="button" className={chip(mode === "custom")} onClick={() => mode !== "custom" && setPct(60)}>Personalizado</button>
        </div>
        {mode === "custom" && pct !== null && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="w-28 truncate">{payer.name}: {pct}%</span>
            <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="flex-1 accent-blue-600" />
            <span className="w-28 truncate text-right">{other.name}: {100 - pct}%</span>
          </div>
        )}
        <input type="hidden" name="payerSharePct" value={pct ?? "renda"} />
        {mode === "renda" && (
          <p className="mt-2 text-[11px] text-zinc-500">A divisão acompanha a renda de cada mês: se a renda mudar, as próximas parcelas mudam junto.</p>
        )}
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
