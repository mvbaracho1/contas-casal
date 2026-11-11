import { deleteIncome } from "@/app/actions-finance";
import { IncomeForm } from "@/components/finance-forms";
import { IconTrash } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Avatar, fmtPct, Illustration, MEMBER_COLORS, Money, pct } from "@/components/ui";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeIn, currentYm, formatBRL, formatYm, incomeByUser } from "@/lib/ledger";
import { ConfirmButton } from "@/components/confirm-button";
import { ParamClass, ParamLink, ParamView } from "@/components/url-state";

// ?editar=ID troca no navegador (url-state): os formulários de edição já vêm prontos do servidor.
export default async function RendaPage() {
  const { couple, me, memberIds, names } = await requireCouple();
  const incomes = await prisma.income.findMany({ where: { coupleId: couple.id }, orderBy: [{ startMonth: "desc" }, { createdAt: "asc" }] });
  const month = currentYm();
  const byUser = incomeByUser(incomes, month, memberIds);
  const total = byUser[memberIds[0]] + byUser[memberIds[1]];

  return (
    <>
      <PageHeader title="Nossa renda" subtitle={`Renda líquida de ${formatYm(month).toLowerCase()}`} addButton={false} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Renda do casal</h2>
                <div className="mt-2"><Money cents={total} size="lg" /></div>
                <p className="muted text-xs">por mês, somando os dois</p>
              </div>
              <Illustration emoji="💰" />
            </div>
            <div className="mt-4 flex h-6 overflow-hidden rounded-lg bg-zinc-100 text-[10px] font-semibold text-white dark:bg-zinc-800">
              {total > 0 &&
                memberIds.map((id, i) => (
                  <div key={id} className={`flex items-center px-2 ${MEMBER_COLORS[i].bar} ${i === 1 ? "justify-end" : ""}`} style={{ width: `${pct(byUser[id], total)}%` }}>
                    {pct(byUser[id], total) >= 15 && fmtPct(pct(byUser[id], total))}
                  </div>
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {memberIds.map((id, i) => (
                <div key={id} className={i === 1 ? "text-right" : ""}>
                  <p className={`muted flex items-center gap-1.5 ${i === 1 ? "justify-end" : ""}`}>
                    <span className={`size-1.5 rounded-full ${MEMBER_COLORS[i].dot}`} /> {id === me.id ? "Você" : names[id]}
                  </p>
                  <p className="tabular mt-0.5 text-sm font-semibold">{formatBRL(byUser[id])}</p>
                </div>
              ))}
            </div>
            <p className="muted mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] dark:bg-zinc-800/60">
              Contas fixas marcadas como <b>proporcional à renda</b> são divididas nessa proporção.
            </p>
          </section>

          <section className="card">
            <h2 className="card-title">Rendas cadastradas</h2>
            {incomes.length === 0 ? (
              <p className="muted mt-3 text-sm">Nenhuma renda ainda. Comece pelo salário de cada um.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                {incomes.map((i) => {
                  const active = activeIn(i, month);
                  return (
                    <li key={i.id} className={`flex items-center gap-3 py-3 ${active ? "" : "opacity-60"}`}>
                      <Avatar name={names[i.userId]} index={memberIds.indexOf(i.userId)} />
                      <ParamLink param="editar" value={i.id} push scrollTo="painel" className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.description}</p>
                        <p className="muted truncate text-xs">
                          {names[i.userId]} · desde {formatYm(i.startMonth)}
                          {i.endMonth && ` até ${formatYm(i.endMonth)}`}
                          {!active && " · fora do período"}
                        </p>
                      </ParamLink>
                      <span className="tabular text-sm font-semibold">{formatBRL(i.amountCents)}</span>
                      <form action={deleteIncome}>
                        <input type="hidden" name="id" value={i.id} />
                        <ConfirmButton
                          className="btn-icon size-8 hover:text-red-600" aria-label="Excluir renda"
                          title="Excluir renda?" message={<><b>{i.description}</b> ({formatBRL(i.amountCents)}) será apagada.</>}
                        >
                          <IconTrash width={14} height={14} />
                        </ConfirmButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <ParamClass not param="editar" values={[""]} activeClassName="order-first lg:order-none">
          <div id="painel" className="scroll-mt-20" />
          {incomes.map((editing) => (
            <ParamView key={editing.id} param="editar" values={[editing.id]}>
              <IncomeForm
                key={editing.id}
                members={couple.members}
                defaults={{ id: editing.id, userId: editing.userId, description: editing.description, amountCents: editing.amountCents, startMonth: editing.startMonth, endMonth: editing.endMonth }}
              />
            </ParamView>
          ))}
          <ParamView param="editar" values={[""]}>
            <IncomeForm key="new"
                members={couple.members} defaults={{ userId: me.id, startMonth: month }} />
          </ParamView>
        </ParamClass>
      </div>
    </>
  );
}
