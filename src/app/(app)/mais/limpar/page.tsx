import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ResetDataForm } from "@/components/reset-data-form";
import { requireCouple } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Limpar dados · Contas do Casal" };

export default async function LimparDadosPage() {
  const { couple } = await requireCouple();
  const where = { coupleId: couple.id };
  const [compras, cartoes, contas, renda, acertos, receber, metas] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.card.count({ where }),
    prisma.bill.count({ where }),
    prisma.income.count({ where }),
    prisma.settlement.count({ where }),
    prisma.receivable.count({ where }),
    prisma.goal.count({ where }),
  ]);

  const parts = [
    { key: "compras", label: "Compras", emoji: "🛍️", count: compras, hint: "Inclui parceladas, assinaturas e importadas" },
    { key: "cartoes", label: "Cartões", emoji: "💳", count: cartoes },
    { key: "contas", label: "Contas fixas", emoji: "📅", count: contas, hint: "E as marcações de “pago”" },
    { key: "renda", label: "Renda", emoji: "💼", count: renda },
    { key: "acertos", label: "Transferências (acertos)", emoji: "🔁", count: acertos },
    { key: "receber", label: "A receber", emoji: "🤝", count: receber, hint: "E os recebimentos registrados" },
    { key: "metas", label: "Metas", emoji: "🎯", count: metas, hint: "E os aportes" },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Limpar dados" subtitle="Apagar tudo e cadastrar de novo" addButton={false} actions={<Link href="/mais" className="btn-outline">Voltar</Link>} />
      <section className="card space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>🧹</span>
          <p className="muted text-sm">
            Escolha o que apagar do <b className="text-zinc-700 dark:text-zinc-200">{couple.name}</b>. Útil para recomeçar do zero ou limpar testes.
            O login de vocês dois e o casal não são apagados.
          </p>
        </div>
        <ResetDataForm parts={parts} />
      </section>
    </div>
  );
}
