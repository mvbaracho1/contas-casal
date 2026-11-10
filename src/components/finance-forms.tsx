"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveBill, saveCard, saveIncome } from "@/app/actions-finance";
import { BILL_CATEGORIES, CARD_COLORS, CARD_STYLES } from "@/lib/finance";
import { Message, Submit } from "./form-bits";

type Member = { id: string; name: string };

const chip = (active: boolean) =>
  `rounded-xl border px-3 py-2.5 text-left text-sm transition ${
    active
      ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 ring-4 ring-blue-500/10 dark:bg-blue-950 dark:text-blue-300"
      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
  }`;

function FormShell({ title, editing, cancelHref, children }: { title: [string, string]; editing: boolean; cancelHref: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="card-title">{editing ? title[1] : title[0]}</h2>
        {editing && <Link href={cancelHref} className="text-xs font-medium text-blue-600">Cancelar</Link>}
      </div>
      {children}
    </div>
  );
}

function MemberPicker({ name, members, value, onChange }: { name: string; members: Member[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {members.map((m) => (
        <label key={m.id} className={`cursor-pointer ${chip(value === m.id)}`}>
          <input type="radio" name={name} value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} className="sr-only" />
          {m.name}
        </label>
      ))}
    </div>
  );
}

function Period({ start, end }: { start: string; end?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="startMonth">A partir de</label>
        <input className="input" id="startMonth" name="startMonth" type="month" required defaultValue={start} />
      </div>
      <div>
        <label className="label" htmlFor="endMonth">Até (opcional)</label>
        <input className="input" id="endMonth" name="endMonth" type="month" defaultValue={end ?? ""} />
      </div>
    </div>
  );
}

const money = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

// ---------- Renda ----------

export interface IncomeDefaults {
  id?: string;
  userId: string;
  description?: string;
  amountCents?: number;
  startMonth: string;
  endMonth?: string | null;
}

export function IncomeForm({ members, defaults }: { members: Member[]; defaults: IncomeDefaults }) {
  const [state, action] = useActionState(saveIncome, undefined);
  const [userId, setUserId] = useState(defaults.userId);
  return (
    <FormShell title={["Nova renda", "Editar renda"]} editing={!!defaults.id} cancelHref="/renda">
      <form action={action} className="space-y-4" key={defaults.id ?? "new"}>
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        <fieldset>
          <legend className="label">De quem é</legend>
          <MemberPicker name="userId" members={members} value={userId} onChange={setUserId} />
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="description">Descrição</label>
            <input className="input" id="description" name="description" required defaultValue={defaults.description ?? "Salário"} />
          </div>
          <div>
            <label className="label" htmlFor="amount">Valor líquido mensal (R$)</label>
            <input className="input" id="amount" name="amount" required inputMode="decimal" placeholder="8.500,00" defaultValue={money(defaults.amountCents)} />
          </div>
        </div>
        <Period start={defaults.startMonth} end={defaults.endMonth} />
        <Message state={state} />
        <Submit className="btn w-full">{defaults.id ? "Salvar alterações" : "Adicionar renda"}</Submit>
      </form>
    </FormShell>
  );
}

// ---------- Cartão ----------

export interface CardDefaults {
  id?: string;
  name?: string;
  ownerId: string;
  closingDay?: number;
  dueDay?: number;
  limitCents?: number | null;
  color?: string;
}

export function CardForm({ members, defaults }: { members: Member[]; defaults: CardDefaults }) {
  const [state, action] = useActionState(saveCard, undefined);
  const [ownerId, setOwnerId] = useState(defaults.ownerId);
  const [color, setColor] = useState(defaults.color ?? "black");
  return (
    <FormShell title={["Novo cartão", "Editar cartão"]} editing={!!defaults.id} cancelHref="/cartoes">
      <form action={action} className="space-y-4" key={defaults.id ?? "new"}>
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        <div>
          <label className="label" htmlFor="name">Nome do cartão</label>
          <input className="input" id="name" name="name" required placeholder="Ex: Nubank, Santander Unique" defaultValue={defaults.name} />
        </div>
        <fieldset>
          <legend className="label">Titular</legend>
          <MemberPicker name="ownerId" members={members} value={ownerId} onChange={setOwnerId} />
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="closingDay">Fecha dia</label>
            <input className="input" id="closingDay" name="closingDay" type="number" min={1} max={31} required defaultValue={defaults.closingDay ?? 28} />
          </div>
          <div>
            <label className="label" htmlFor="dueDay">Vence dia</label>
            <input className="input" id="dueDay" name="dueDay" type="number" min={1} max={31} required defaultValue={defaults.dueDay ?? 5} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="limit">Limite (opcional)</label>
            <input className="input" id="limit" name="limit" inputMode="decimal" placeholder="15.000,00" defaultValue={money(defaults.limitCents)} />
          </div>
        </div>
        <fieldset>
          <legend className="label">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((c) => (
              <label key={c} title={CARD_STYLES[c].label} className={`size-8 cursor-pointer rounded-full ${CARD_STYLES[c].swatch} ${color === c ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900" : ""}`}>
                <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" />
              </label>
            ))}
          </div>
        </fieldset>
        <Message state={state} />
        <Submit className="btn w-full">{defaults.id ? "Salvar alterações" : "Adicionar cartão"}</Submit>
      </form>
    </FormShell>
  );
}

// ---------- Conta fixa ----------

export interface BillDefaults {
  id?: string;
  name?: string;
  category?: string;
  amountCents?: number;
  dueDay?: number;
  paidById: string;
  payerSharePct?: number | null;
  startMonth: string;
  endMonth?: string | null;
}

export function BillForm({ members, defaults }: { members: Member[]; defaults: BillDefaults }) {
  const [state, action] = useActionState(saveBill, undefined);
  const [paidById, setPaidById] = useState(defaults.paidById);
  // "renda" = proporcional; senão % de quem paga
  const [split, setSplit] = useState<string>(defaults.id ? (defaults.payerSharePct ?? "renda").toString() : "renda");
  const payer = members.find((m) => m.id === paidById)!;
  const other = members.find((m) => m.id !== paidById)!;
  const mode = split === "renda" ? "renda" : split === "50" ? "split" : split === "100" ? "payer" : split === "0" ? "other" : "custom";

  return (
    <FormShell title={["Nova conta fixa", "Editar conta fixa"]} editing={!!defaults.id} cancelHref="/contas">
      <form action={action} className="space-y-4" key={defaults.id ?? "new"}>
        {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label" htmlFor="name">Nome</label>
            <input className="input" id="name" name="name" required placeholder="Aluguel, condomínio, luz…" defaultValue={defaults.name} />
          </div>
          <div>
            <label className="label" htmlFor="amount">Valor mensal (R$)</label>
            <input className="input" id="amount" name="amount" required inputMode="decimal" placeholder="1.580,00" defaultValue={money(defaults.amountCents)} />
          </div>
          <div>
            <label className="label" htmlFor="dueDay">Vence dia</label>
            <input className="input" id="dueDay" name="dueDay" type="number" min={1} max={31} required defaultValue={defaults.dueDay ?? 10} />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="category">Categoria</label>
            <select className="input" id="category" name="category" defaultValue={defaults.category ?? "Moradia"}>
              {BILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Quem paga (sai da conta de quem)</legend>
          <MemberPicker name="paidById" members={members} value={paidById} onChange={setPaidById} />
        </fieldset>

        <fieldset>
          <legend className="label">Como dividir</legend>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={chip(mode === "renda")} onClick={() => setSplit("renda")}>Proporcional à renda</button>
            <button type="button" className={chip(mode === "split")} onClick={() => setSplit("50")}>Dividida 50/50</button>
            <button type="button" className={chip(mode === "payer")} onClick={() => setSplit("100")}>Só de {payer.name}</button>
            <button type="button" className={chip(mode === "other")} onClick={() => setSplit("0")}>Só de {other.name}</button>
          </div>
          <button type="button" className={`mt-2 w-full ${chip(mode === "custom")}`} onClick={() => mode !== "custom" && setSplit("60")}>Personalizado</button>
          {mode === "custom" && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="w-24 truncate">{payer.name}: {split}%</span>
              <input type="range" min={0} max={100} step={5} value={Number(split)} onChange={(e) => setSplit(e.target.value)} className="flex-1 accent-blue-600" />
              <span className="w-24 truncate text-right">{other.name}: {100 - Number(split)}%</span>
            </div>
          )}
          <input type="hidden" name="split" value={split} />
          <p className="mt-2 text-[11px] text-zinc-500">
            {mode === "renda"
              ? "Cada um paga de acordo com o quanto ganha (cadastre a renda em Nossa renda)."
              : mode === "payer"
                ? "Conta pessoal: não gera acerto entre vocês."
                : "A parte do outro entra no acerto do mês."}
          </p>
        </fieldset>

        <Period start={defaults.startMonth} end={defaults.endMonth} />
        <Message state={state} />
        <Submit className="btn w-full">{defaults.id ? "Salvar alterações" : "Adicionar conta"}</Submit>
      </form>
    </FormShell>
  );
}
