import Link from "next/link";
import { deleteGoal, deleteGoalEntry } from "@/app/actions-goals";
import { GoalEntryForm, GoalForm } from "@/components/goal-forms";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Avatar, Money } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emergencyFundSuggestion, summarizeGoal, type GoalSummary } from "@/lib/goals";
import { activeIn, currentYm, formatBRL, formatYm } from "@/lib/ledger";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata = { title: "Metas · Contas do Casal" };

const STATUS: Record<GoalSummary["status"], { label: string; cls: string }> = {
  concluida: { label: "Concluída 🎉", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  atrasada: { label: "Prazo passou", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  andamento: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
};

function Progress({ pct, done, className = "h-2" }: { pct: number; done: boolean; className?: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      <span className={`block h-full rounded-full ${done ? "bg-emerald-500" : "bg-gradient-to-r from-blue-600 to-blue-400"}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export default async function MetasPage({ searchParams }: { searchParams: Promise<{ ver?: string; editar?: string; nova?: string }> }) {
  const { couple, me, memberIds, names } = await requireCouple();
  const { ver, editar, nova } = await searchParams;
  const today = currentYm();

  const [goals, bills] = await Promise.all([
    prisma.goal.findMany({
      where: { coupleId: couple.id },
      include: { entries: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bill.findMany({ where: { coupleId: couple.id }, select: { amountCents: true, startMonth: true, endMonth: true } }),
  ]);
  const items = goals.map((g) => ({ g, s: summarizeGoal(g, g.entries, today, memberIds) }));
  const totalSaved = items.reduce((a, x) => a + x.s.savedCents, 0);
  const totalTarget = items.reduce((a, x) => a + x.g.targetCents, 0);
  const monthly = items.reduce((a, x) => a + (x.s.monthlyCents ?? 0), 0);
  const emergencyCents = emergencyFundSuggestion(bills.filter((b) => activeIn(b, today)).reduce((a, b) => a + b.amountCents, 0));

  const selected = items.find((x) => x.g.id === ver);
  const editing = goals.find((g) => g.id === editar);
  const showForm = !selected && (editing || nova || goals.length === 0);

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Viagem, reserva de emergência e o que mais vocês querem juntar"
        addButton={false}
        actions={<Link href="/metas?nova=1" className="btn hidden sm:inline-flex">+ Nova meta</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Juntos já guardaram</h2>
                <div className="mt-2"><Money cents={totalSaved} size="lg" /></div>
                <p className="muted text-xs">
                  {goals.length ? `de ${formatBRL(totalTarget)} em ${goals.length} ${goals.length === 1 ? "meta" : "metas"}` : "Crie a primeira meta do casal"}
                </p>
              </div>
              <span className="text-4xl sm:text-5xl" aria-hidden>🎯</span>
            </div>
            {totalTarget > 0 && <Progress pct={Math.min(100, (totalSaved / totalTarget) * 100)} done={totalSaved >= totalTarget} className="mt-3 h-2.5" />}
            {monthly > 0 && (
              <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                Para cumprir os prazos, guardem <b className="tabular">{formatBRL(monthly)}</b> por mês somando as metas.
              </p>
            )}
          </section>

          <div className="flex items-center justify-between sm:hidden">
            <span className="muted text-xs">{goals.length} {goals.length === 1 ? "meta" : "metas"}</span>
            <Link href="/metas?nova=1" className="btn">+ Nova meta</Link>
          </div>

          {items.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map(({ g, s }) => (
                <li key={g.id}>
                  <Link
                    href={`/metas?ver=${g.id}`}
                    className={`card flex h-full flex-col gap-3 transition hover:border-blue-300 dark:hover:border-blue-800 ${g.id === ver ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800" aria-hidden>{g.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{g.name}</p>
                        <span className={`pill mt-1 ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                      </div>
                      <span className="tabular text-sm font-bold">{Math.floor(s.pct)}%</span>
                    </div>
                    <Progress pct={s.pct} done={s.status === "concluida"} />
                    <div className="flex items-end justify-between gap-2 text-xs">
                      <div>
                        <p className="tabular text-sm font-semibold">{formatBRL(s.savedCents)}</p>
                        <p className="muted">de {formatBRL(g.targetCents)}</p>
                      </div>
                      <div className="text-right">
                        {s.monthlyCents !== null ? (
                          <>
                            <p className="tabular font-semibold">{formatBRL(s.monthlyCents)}/mês</p>
                            <p className="muted">até {formatYm(g.targetMonth!).toLowerCase()}</p>
                          </>
                        ) : (
                          <p className="muted">{s.status === "concluida" ? "Meta alcançada" : "Sem prazo"}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={selected || showForm ? "order-first space-y-4 lg:order-none" : "space-y-4"}>
          {selected ? (
            <Detail item={selected} memberIds={memberIds} names={names} meId={me.id} members={couple.members} />
          ) : showForm ? (
            <GoalForm
              key={editing?.id ?? "new"}
              emergencyCents={emergencyCents}
              defaults={editing ? { id: editing.id, name: editing.name, emoji: editing.emoji, targetCents: editing.targetCents, targetMonth: editing.targetMonth, note: editing.note } : {}}
            />
          ) : (
            <div className="card hidden text-center lg:block">
              <p className="muted text-sm">Escolha uma meta para ver os aportes, ou crie uma nova.</p>
              <Link href="/metas?nova=1" className="btn mt-3">+ Nova meta</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

type Item = {
  g: Awaited<ReturnType<typeof prisma.goal.findMany<{ include: { entries: true } }>>>[number];
  s: GoalSummary;
};

function Detail({ item: { g, s }, memberIds, names, meId, members }: {
  item: Item;
  memberIds: [string, string];
  names: Record<string, string>;
  meId: string;
  members: { id: string; name: string }[];
}) {
  const who = (id: string) => (id === meId ? "Você" : names[id]);
  const positive = memberIds.map((id) => Math.max(0, s.byMember[id] ?? 0));
  const totalPos = positive[0] + positive[1];
  return (
    <section className="card space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-3xl dark:bg-zinc-800" aria-hidden>{g.emoji}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{g.name}</h2>
          <span className={`pill mt-1 ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
        </div>
        <Link href="/metas" className="btn-icon" aria-label="Fechar">✕</Link>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="muted text-xs">Guardado</p>
            <Money cents={s.savedCents} size="lg" />
          </div>
          <p className="tabular text-right text-xs text-zinc-500">
            meta {formatBRL(g.targetCents)}
            <br />
            <b className="text-zinc-700 dark:text-zinc-200">{Math.floor(s.pct)}%</b>
          </p>
        </div>
        <Progress pct={s.pct} done={s.status === "concluida"} className="mt-2 h-2.5" />
        <p className="muted mt-2 text-xs">
          {s.status === "concluida"
            ? "Vocês chegaram lá! 🎉"
            : s.monthlyCents !== null
              ? s.monthsLeft
                ? <>Faltam <b>{formatBRL(s.remainingCents)}</b>: guardem <b>{formatBRL(s.monthlyCents)}</b> por mês até {formatYm(g.targetMonth!).toLowerCase()}.</>
                : <>O prazo ({formatYm(g.targetMonth!).toLowerCase()}) passou e faltam <b>{formatBRL(s.remainingCents)}</b>. Que tal ajustar o prazo?</>
              : <>Faltam <b>{formatBRL(s.remainingCents)}</b>. Sem prazo definido.</>}
        </p>
        {g.note && <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{g.note}</p>}
      </div>

      {totalPos > 0 && (
        <div>
          <p className="text-xs font-semibold">Quem guardou</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full">
            <span className="bg-blue-600" style={{ width: `${(positive[0] / totalPos) * 100}%` }} />
            <span className="flex-1 bg-rose-500" />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            {memberIds.map((id, i) => (
              <span key={id} className={`flex items-center gap-1.5 ${i === 1 ? "flex-row-reverse" : ""}`}>
                <Avatar name={names[id]} index={i} size="sm" />
                <span>{who(id)} <b className="tabular">{formatBRL(positive[i])}</b></span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
        <GoalEntryForm
          key={g.id}
          goalId={g.id}
          members={members}
          meId={meId}
          savedCents={s.savedCents}
          suggestedCents={s.monthlyCents ?? 0}
        />
      </div>

      {g.entries.length > 0 && (
        <div>
          <p className="text-xs font-semibold">Histórico</p>
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {g.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                <Avatar name={names[e.userId]} index={memberIds.indexOf(e.userId)} size="sm" />
                <span className="flex-1 text-xs text-zinc-500">
                  {e.date.toISOString().slice(0, 10).split("-").reverse().join("/")} · {who(e.userId)} {e.amountCents >= 0 ? "guardou" : "retirou"}
                </span>
                <span className={`tabular text-xs font-semibold ${e.amountCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                  {e.amountCents >= 0 ? "+" : "−"}{formatBRL(Math.abs(e.amountCents))}
                </span>
                <form action={deleteGoalEntry}>
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmButton
                    className="btn-icon size-7 hover:text-red-600" aria-label="Excluir lançamento"
                    title={e.amountCents >= 0 ? "Excluir aporte?" : "Excluir retirada?"}
                    message={<>O lançamento de <b>{formatBRL(Math.abs(e.amountCents))}</b> será apagado da meta.</>}
                  >
                    <IconTrash width={13} height={13} />
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <Link href={`/metas?editar=${g.id}`} className="btn-outline py-2 text-sm">Editar meta</Link>
        <form action={deleteGoal}>
          <input type="hidden" name="id" value={g.id} />
          <ConfirmButton className="btn-danger" title="Excluir meta?" message={<>A meta <b>{g.emoji} {g.name}</b> e todos os aportes serão apagados.</>}>
            <IconTrash /> Excluir
          </ConfirmButton>
        </form>
      </div>
    </section>
  );
}
