# Contas do Casal

Controle de compras, parcelamentos e acertos mensais de um casal: quem pagou, de quem é a compra e quanto cada um precisa enviar para o outro no fim do mês.

**Stack:** Next.js 15 (App Router, Server Actions) · Prisma · Postgres (Neon) · Tailwind · Vercel

## Como funciona

- Cada pessoa cria sua conta (e-mail e senha). Uma cria o **casal** e passa o **código de convite** para a outra.
- Cada **compra** registra:
  - **Quem pagou**: o dono do cartão ou da conta usada.
  - **De quem é**: dividida 50/50, só de quem pagou, só do outro ou um percentual personalizado.
  - **Parcelas** e o **mês da 1ª parcela** (o mês da fatura).
- Exemplo: a esposa compra um tênis de R$ 600 em 3x no cartão do marido. Você marca "Pago por: marido" e "Só da esposa". Em cada um dos 3 meses, ela deve R$ 200 a ele.
- **Nossa renda**: o salário (e outras rendas) de cada um, com mês de início e fim. Serve para o *saldo previsto* e para dividir contas proporcionalmente.
- **Contas fixas**: aluguel, condomínio, luz, assinaturas… com dia de vencimento, quem paga e como dividir (proporcional à renda, 50/50, só de um ou personalizado). A parte do outro entra no acerto do mês. Contas da categoria *Moradia* alimentam o card de moradia (referência de até 30% do salário).
- **Cartões**: titular, dia de fechamento/vencimento, limite e cor. Ao escolher o cartão numa compra, o mês da fatura é sugerido pelo fechamento. A fatura é a soma das parcelas daquele cartão no mês.
- **Contas a pagar**: contas fixas e faturas do mês, que podem ser marcadas como pagas.
- O **Resumo** de cada mês compensa o que um deve ao outro e mostra quem envia quanto para quem. Depois do Pix, registre a **transferência** e o mês fica zerado. Se ficou algo pendente de meses anteriores, o resumo avisa.

## Rodando localmente

```bash
pnpm install
cp .env.example .env        # preencha AUTH_SECRET
docker compose up -d db     # Postgres local na porta 5434
pnpm db:migrate
pnpm dev
```

`pnpm test` roda os testes da lógica de cálculo ([src/lib/ledger.ts](src/lib/ledger.ts)).

## Deploy na Vercel

1. Suba o repositório no GitHub e importe o projeto na Vercel.
2. Em **Storage → Neon (Marketplace)**, crie um banco e conecte ao projeto. Isso cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
3. Em **Settings → Environment Variables**, adicione `AUTH_SECRET` (32 caracteres ou mais):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
4. Faça o deploy. O build roda `prisma migrate deploy` antes do `next build`, então as tabelas são criadas automaticamente.
