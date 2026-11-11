"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { importStatement, readStatement } from "@/app/actions-import";
import { formatBRL, formatYm } from "@/lib/ledger";
import { isDuplicate, type ExistingPurchase, type StatementItem } from "@/lib/statement";
import { Message, Submit } from "./form-bits";
import type { CardOption } from "./purchase-form";

type Member = { id: string; name: string };
const MAX_BYTES = 4 * 1024 * 1024;

export function ImportStatement({
  members,
  meId,
  cards,
  existing,
  defaultMonth,
  incomePct,
  people = [],
  defaultCardId,
}: {
  members: Member[];
  meId: string;
  cards: CardOption[];
  existing: ExistingPurchase[];
  defaultMonth: string;
  incomePct: Record<string, number> | null;
  people?: string[];
  /** cartão já escolhido (vindo da página de cartões) */
  defaultCardId?: string;
}) {
  const initialCard = cards.find((c) => c.id === defaultCardId) ?? cards[0];
  const [readState, readAction] = useActionState(readStatement, undefined);
  const [cardId, setCardId] = useState(initialCard?.id ?? "");
  const [payerId, setPayerId] = useState(initialCard?.ownerId ?? meId);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const result = readState?.result;
  // Cada leitura devolve um objeto novo: a revisão abre sozinha, e "Trocar arquivo" a fecha.
  const [dismissed, setDismissed] = useState<typeof result>(undefined);
  const showReview = result && result.items.length > 0 && dismissed !== result;

  if (showReview) {
    return (
      <Review
        key={result.fileName + result.items.length}
        items={result.items}
        dueMonth={result.dueMonth ?? defaultMonth}
        detected={Boolean(result.dueMonth)}
        fileName={result.fileName}
        members={members}
        payerId={payerId}
        cardId={cardId || null}
        card={cards.find((c) => c.id === cardId)}
        existing={existing}
        incomePct={incomePct}
        people={people}
        onBack={() => setDismissed(result)}
      />
    );
  }

  const chooseCard = (id: string) => {
    setCardId(id);
    const c = cards.find((x) => x.id === id);
    if (c) setPayerId(c.ownerId);
  };

  return (
    <form
      className="card space-y-4"
      action={async (fd) => {
        setLocalError("");
        if (!file) return setLocalError("Escolha o arquivo da fatura");
        if (file.size > MAX_BYTES) return setLocalError("Arquivo muito grande (máximo 4 MB)");
        // o React limpa o <input type=file> depois do envio: usamos o arquivo guardado no estado
        fd.set("file", file);
        fd.set("password", password);
        readAction(fd);
      }}
    >
      <div>
        <h2 className="card-title">Importar fatura</h2>
        <p className="muted text-sm">PDF da fatura, ou o arquivo OFX/CSV exportado pelo app do banco. Na próxima tela você confere tudo antes de salvar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="card">Cartão da fatura</label>
          <select className="input" id="card" value={cardId} onChange={(e) => chooseCard(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {members.find((m) => m.id === c.ownerId)?.name}</option>
            ))}
            <option value="">Cartão não cadastrado</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payer">Titular (quem paga a fatura)</label>
          <select className="input" id="payer" value={payerId} disabled={Boolean(cardId)} onChange={(e) => setPayerId(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="file">Arquivo</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:bg-blue-950/30"
        >
          <span className="text-3xl" aria-hidden>📄</span>
          <span className="text-sm font-semibold">{file ? file.name : "Escolher arquivo"}</span>
          <span className="muted text-xs">{file ? `${(file.size / 1024).toFixed(0)} KB · toque para trocar` : "PDF, OFX ou CSV · até 4 MB"}</span>
        </button>
        <input
          ref={fileRef} id="file" type="file" className="sr-only" accept=".pdf,.ofx,.csv,.txt,application/pdf,text/csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPassword(""); }}
        />
      </div>

      {readState?.needsPassword && (
        <div>
          <label className="label" htmlFor="pdf-password">Senha do PDF</label>
          <input className="input" id="pdf-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Geralmente os primeiros dígitos do CPF" />
          <p className="mt-1 text-[11px] text-zinc-500">A senha é usada só para abrir o arquivo e não fica guardada.</p>
        </div>
      )}

      <Message state={localError ? { error: localError } : readState?.error ? { error: readState.error } : undefined} />
      {result && result.items.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Não encontramos lançamentos nesse arquivo. Se for PDF, tente exportar a fatura em OFX ou CSV pelo app do banco.
        </p>
      )}
      {result && result.items.length > 0 && !showReview && (
        <button type="button" className="btn-outline w-full py-2.5 text-sm" onClick={() => setDismissed(undefined)}>
          Revisar {result.items.length} lançamentos de {result.fileName}
        </button>
      )}
      <Submit className="btn w-full py-2.5">Ler fatura</Submit>
    </form>
  );
}

// ---------- Revisão ----------

type Row = StatementItem & { id: number };

function Review({
  items, dueMonth, detected, fileName, members, payerId, cardId, card, existing, incomePct, people, onBack,
}: {
  items: StatementItem[];
  dueMonth: string;
  detected: boolean;
  fileName: string;
  members: Member[];
  payerId: string;
  cardId: string | null;
  card: CardOption | undefined;
  existing: ExistingPurchase[];
  incomePct: Record<string, number> | null;
  people: string[];
  onBack: () => void;
}) {
  const [state, action] = useActionState(importStatement, undefined);
  const [month, setMonth] = useState(dueMonth);
  const [rows, setRows] = useState<Row[]>(() => items.map((it, id) => ({ ...it, id })));
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  // "renda" = proporcional à renda; senão % de quem pagou
  const [share, setShare] = useState<Record<number, string>>({});
  // Padrão: a compra é de quem é a fatura (o titular do cartão).
  const [defaultShare, setDefaultShare] = useState("100");
  // compras de amigos no cartão: nome de quem vai pagar (vai para "A receber")
  const [friendNames, setFriendNames] = useState<Record<number, string>>({});
  // compras à vista marcadas como assinatura (repetem todo mês na fatura)
  const [recurring, setRecurring] = useState<Record<number, boolean>>({});
  const isRecurring = (r: Row) => !r.installment && shareOf(r) !== "amigo" && Boolean(recurring[r.id]);

  const payer = members.find((m) => m.id === payerId)!;
  const other = members.find((m) => m.id !== payerId)!;
  const shareOptions = [
    { v: "renda", label: incomePct ? `Pela renda (${incomePct[payer.id]}/${incomePct[other.id]})` : "Pela renda" },
    { v: "50", label: "Dividida 50/50" },
    { v: "100", label: `Só de ${payer.name}` },
    { v: "0", label: `Só de ${other.name}` },
  ];
  const rowOptions = [...shareOptions, { v: "amigo", label: "De um amigo…" }];
  const shareOf = (r: Row) => share[r.id] ?? defaultShare;
  const otherPct = (s: string) => (s === "amigo" ? 0 : s === "renda" ? (incomePct?.[other.id] ?? 50) : 100 - Number(s));
  const friendOf = (r: Row) => (friendNames[r.id] ?? "").trim();

  const charges = rows.filter((r) => r.kind === "charge");
  const credits = rows.filter((r) => r.kind === "credit");
  const dup = useMemo(() => new Set(charges.filter((r) => isDuplicate(r, month, cardId, existing)).map((r) => r.id)), [charges, month, cardId, existing]);
  const isPicked = (r: Row) => picked[r.id] ?? !dup.has(r.id);
  const selected = charges.filter(isPicked);
  const total = selected.reduce((a, r) => a + r.amountCents, 0);
  const owed = selected.reduce((a, r) => a + Math.round((r.amountCents * otherPct(shareOf(r))) / 100), 0);
  const fromFriends = selected.filter((r) => shareOf(r) === "amigo");
  const missingFriend = fromFriends.some((r) => !friendOf(r));
  const friendsTotal = fromFriends.reduce((a, r) => a + r.amountCents, 0);
  const recurringCount = selected.filter(isRecurring).length;

  const payload = JSON.stringify({
    cardId,
    paidById: payerId,
    month,
    items: selected.map((r) => ({
      description: r.description,
      date: r.date,
      amountCents: r.amountCents,
      k: r.installment?.k ?? 1,
      n: r.installment?.n ?? 1,
      payerSharePct: shareOf(r) === "amigo" ? 100 : shareOf(r) === "renda" ? null : Number(shareOf(r)),
      friendName: shareOf(r) === "amigo" ? friendOf(r) : undefined,
      recurring: isRecurring(r) || undefined,
    })),
  });

  const chip = (on: boolean) =>
    `rounded-xl border px-3 py-2 text-sm transition ${on ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`;

  return (
    <div className="space-y-4">
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title">Revisar lançamentos</h2>
            <p className="muted truncate text-xs">{fileName} · {card ? card.name : "sem cartão"} · titular {payer.name}</p>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onBack}>Trocar arquivo</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="month">Mês da fatura (vencimento)</label>
            <input className="input" id="month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            <p className="mt-1 text-[11px] text-zinc-500">
              {detected ? "Encontrado no arquivo. " : "Não achamos o vencimento no arquivo: confira. "}
              Parcelas como 3/10 contam a partir de {formatYm(month)}.
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className="label">De quem são as compras? (padrão)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {shareOptions.map((o) => (
                <button key={o.v} type="button" className={chip(defaultShare === o.v)} onClick={() => setDefaultShare(o.v)}>
                  <span className="line-clamp-2 text-xs sm:text-sm">{o.label}</span>
                </button>
              ))}
            </div>
            {defaultShare === "renda" && (
              <p className="mt-1 text-[11px] text-zinc-500">
                {incomePct
                  ? `${payer.name} ${incomePct[payer.id]}% · ${other.name} ${incomePct[other.id]}% pela renda deste mês. Acompanha a renda de cada mês.`
                  : "Ninguém cadastrou renda ainda: fica 50/50 até cadastrarem em “Nossa renda”."}
              </p>
            )}
          </div>
        </div>
      </section>

      {dup.size > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          {dup.size} {dup.size === 1 ? "lançamento parece já estar cadastrado" : "lançamentos parecem já estar cadastrados"} (de uma importação anterior) e {dup.size === 1 ? "veio desmarcado" : "vieram desmarcados"}.
        </p>
      )}

      {[
        { title: "À vista", list: charges.filter((r) => !r.installment) },
        { title: "Parceladas", list: charges.filter((r) => r.installment) },
      ]
        .filter((g) => g.list.length > 0)
        .map((g) => {
          const subtotal = g.list.filter(isPicked).reduce((a, r) => a + r.amountCents, 0);
          return (
            <section key={g.title} className="card">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="card-title">{g.title} <span className="font-normal text-zinc-400">· {g.list.length}</span></h2>
                  <p className="muted tabular text-xs">{formatBRL(subtotal)} selecionado{g.title === "Parceladas" ? " (parcelas desta fatura)" : ""}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(g.list.map((r) => [r.id, true])) }))}>Todas</button>
                  <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(g.list.map((r) => [r.id, false])) }))}>Nenhuma</button>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                {g.list.map((r) => {
                  const on = isPicked(r);
                  return (
                    <li key={r.id} className={`flex gap-3 py-3 ${on ? "" : "opacity-55"}`}>
                      <input
                        type="checkbox" className="mt-2 size-4 shrink-0 accent-blue-600" checked={on} aria-label={`Importar ${r.description}`}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.checked }))}
                      />
                      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <input
                            className="w-full truncate rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium hover:border-zinc-200 focus:border-blue-500 focus:outline-none dark:hover:border-zinc-700"
                            value={r.description}
                            onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))}
                            aria-label="Descrição"
                          />
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-[11px] text-zinc-500">
                            {r.date && <span>{r.date.split("-").reverse().slice(0, 2).join("/")}</span>}
                            {!r.installment && shareOf(r) !== "amigo" && (
                              <label
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 transition ${
                                  recurring[r.id] ? "bg-violet-100 font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                }`}
                                title="Assinatura: a compra se repete todo mês nesta fatura"
                              >
                                <input
                                  type="checkbox" className="size-3 accent-violet-600"
                                  checked={Boolean(recurring[r.id])}
                                  onChange={(e) => setRecurring((x) => ({ ...x, [r.id]: e.target.checked }))}
                                />
                                🔁 Recorrente
                              </label>
                            )}
                            {r.installment && (
                              <span className="pill bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                parcela {r.installment.k}/{r.installment.n}
                              </span>
                            )}
                            {dup.has(r.id) && <span className="pill bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">já cadastrada</span>}
                          </p>
                        </div>
                        <select
                          className="input w-full py-1.5 text-xs sm:w-40"
                          value={shareOf(r)}
                          onChange={(e) => setShare((s) => ({ ...s, [r.id]: e.target.value }))}
                          aria-label="De quem é"
                        >
                          {rowOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                        <p className="tabular text-right text-sm font-semibold sm:w-24">{formatBRL(r.amountCents)}</p>
                        {shareOf(r) === "amigo" && (
                          <input
                            className="input col-span-2 py-1.5 text-xs sm:col-span-3"
                            placeholder="Nome de quem vai pagar (vai para “A receber”)"
                            list="import-people" autoComplete="off" aria-label="Nome do amigo"
                            value={friendNames[r.id] ?? ""}
                            onChange={(e) => setFriendNames((f) => ({ ...f, [r.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

      <datalist id="import-people">{people.map((p) => <option key={p} value={p} />)}</datalist>

      {credits.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">
            {credits.length === 1 ? "1 pagamento/estorno ignorado" : `${credits.length} pagamentos/estornos ignorados`}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {credits.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">{r.description}</span>
                <span className="tabular shrink-0">−{formatBRL(r.amountCents)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form action={action} className="card sticky bottom-24 z-10 space-y-3 shadow-lg lg:bottom-4">
        <input type="hidden" name="payload" value={payload} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p><b>{selected.length}</b> selecionadas · <b className="tabular">{formatBRL(total)}</b> nesta fatura</p>
            <p className="muted text-xs">
              {owed > 0 ? <>{other.name} fica devendo <b className="tabular">{formatBRL(owed)}</b> a {payer.name} neste mês.</> : "Não gera dívida entre vocês."}
              {friendsTotal > 0 && <> <b className="tabular">{formatBRL(friendsTotal)}</b> vai para “A receber”.</>}
              {recurringCount > 0 && <> {recurringCount} {recurringCount === 1 ? "assinatura vai" : "assinaturas vão"} se repetir todo mês.</>}
            </p>
          </div>
          {missingFriend ? (
            <button type="button" className="btn w-full sm:w-auto" disabled>Informe o nome do amigo</button>
          ) : selected.length > 0 ? (
            <Submit className="btn w-full sm:w-auto">Importar {selected.length} {selected.length === 1 ? "compra" : "compras"}</Submit>
          ) : (
            <button type="button" className="btn w-full sm:w-auto" disabled>Marque as compras para importar</button>
          )}
        </div>
        <Message state={state} />
      </form>
    </div>
  );
}
