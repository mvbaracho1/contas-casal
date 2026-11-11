# Contas do Casal

App para um casal controlar compras, parcelas, cartões, contas fixas e renda, e saber **quem deve quanto a quem** no fim de cada mês.

**Produção:** https://www.contasdocasal.com

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Prisma 6 · Postgres (Neon) · Tailwind CSS 4 · Vercel

> Vai mexer no código? Leia antes o [AGENTS.md](AGENTS.md), que tem as regras e os padrões do projeto.

## Funcionalidades

- **Contas e casal**
  - Cadastro com e-mail e senha ou com o Google. O primeiro do casal precisa de um **código de acesso** de 6 dígitos (`SIGNUP_CODE`); o par entra pelo convite, sem código.
  - Recuperação de senha por e-mail.
  - Quem cria o casal informa o e-mail do par e o app envia um **convite** com link. Também dá para entrar com o código de 6 letras.
- **Compras**
  - Cada compra pode ser à vista ou parcelada, no cartão ou fora dele.
  - Divisão:
    - 50/50;
    - só de quem pagou;
    - só do outro;
    - percentual personalizado;
    - **proporcional à renda** do casal, recalculada mês a mês.
  - Campo **"começar a contar da parcela N"**, para compras antigas que já estavam em andamento.
- **Importar fatura**
  - Formatos aceitos: PDF (inclusive com senha), OFX ou CSV.
  - O app encontra as compras, o vencimento e as parcelas ("3/10") e mostra tudo numa revisão, separada em **à vista** e **parceladas**, antes de gravar.
  - Detecta compras já importadas antes.
  - Ignora pagamentos, estornos e a seção de parcelas de faturas futuras.
- **Cartões:** titular, dia de fechamento e vencimento, limite e cor. A fatura do mês é a soma das parcelas daquele cartão.
- **Contas fixas:** aluguel, luz, assinaturas etc., com vencimento e divisão. Também podem ser divididas proporcionalmente à renda.
- **Nossa renda:** salário e outras rendas de cada um, com mês de início e de fim.
- **A receber**
  - Controle de compras feitas por amigos no seu cartão e de outros valores que te devem: parcelas, pagamentos parciais e status (em dia, atrasado ou quitado).
  - No cadastro ou na importação de uma compra, escolha **"De um amigo"**. A compra continua na fatura do cartão, fica toda com o titular e não gera dívida entre o casal. O valor vai para "A receber".
  - Para cobrar, há o botão **"Cobrar no WhatsApp"** (um link `wa.me`, gratuito, que só abre o WhatsApp com a mensagem pronta) e o botão "Copiar mensagem".
  - A visão geral avisa quando há valor vencido.
  - É só controle: não entra no saldo nem no acerto do casal.
- **Metas do casal**
  - Viagem, reserva de emergência, casa, carro…: valor-alvo, prazo opcional e emoji. Há modelos prontos.
  - Aportes e retiradas registrando quem guardou. O app mostra o progresso, quanto falta e **quanto guardar por mês** para cumprir o prazo.
  - Na reserva de emergência, o app sugere um valor de 6 meses das contas fixas do casal.
  - É só controle: não entra no saldo nem no acerto.
- **Visão geral do mês**
  - Saldo previsto, contas a pagar, faturas dos cartões, moradia e compras do mês.
  - **Acerto:** quem envia quanto para quem. Depois do Pix, registre a transferência e o mês fica zerado. Pendências de meses anteriores aparecem no acerto.

### Exemplo

A esposa compra um tênis de R$ 600 em 3x no cartão do marido. Na compra, marque **Pago por: marido** e **Só da esposa**. Em cada um dos 3 meses, ela deve R$ 200 a ele.

## Rodando localmente

Você precisa de Node 20 ou mais novo, do pnpm e do Docker (para o Postgres local).

```bash
pnpm install
cp .env.example .env          # preencha pelo menos AUTH_SECRET
docker compose up -d db       # Postgres local na porta 5434
pnpm prisma migrate deploy    # cria as tabelas
pnpm dev                      # http://localhost:3000
```

No **Windows**, abra o terminal com o caminho em **C maiúsculo** (`cd C:\Users\...\compras-casal`) antes do `pnpm dev`. Com `c:` minúsculo, o Next carrega módulos duas vezes e aparece o erro *"Could not find the module … in the React Client Manifest"*. Se isso acontecer, pare o servidor, apague a pasta `.next` e suba de novo.

Sem o Resend configurado, os e-mails de convite e de recuperação de senha **aparecem no terminal** em vez de serem enviados.

### Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | `prisma generate` + `prisma migrate deploy` + `next build` (é o que a Vercel roda) |
| `pnpm test` | Testes da lógica de cálculo e do leitor de faturas (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm tsc --noEmit` | Checagem de tipos |
| `pnpm db:studio` | Prisma Studio para ver o banco |

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres com pool. Na Vercel, a integração com o Neon cria essa variável |
| `DATABASE_URL_UNPOOLED` | sim | Conexão direta, usada pelas migrações |
| `AUTH_SECRET` | sim | Assina o cookie de sessão. Precisa ter 32 caracteres ou mais: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_URL` | recomendada | URL pública (`https://www.contasdocasal.com`), usada nos links de e-mail e no retorno do Google |
| `SIGNUP_CODE` | sim (produção) | Código de acesso de 6 dígitos exigido para criar a conta do **primeiro** usuário do casal. Quem entra pelo link de convite não precisa |
| `RESEND_API_KEY` | para e-mails | Chave do [Resend](https://resend.com) |
| `EMAIL_FROM` | para e-mails | Remetente de um domínio verificado no Resend. Ex.: `Contas do Casal <nao-responda@contasdocasal.com>` |
| `GOOGLE_CLIENT_ID` | para o Google | ID do cliente OAuth. O botão do Google só aparece quando estiver definido |
| `GOOGLE_CLIENT_SECRET` | para o Google | Segredo do cliente OAuth |

Todas são lidas **só no servidor**. Nenhuma usa o prefixo `NEXT_PUBLIC_`.

## Deploy (Vercel + Neon)

1. Importe o repositório na Vercel. Todo push na `main` faz deploy automático.
2. Em **Storage → Neon**, crie o banco e conecte ao projeto. Isso cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
3. Em **Settings → Environment Variables**, adicione `AUTH_SECRET` e `APP_URL`.
4. O build roda `prisma migrate deploy`, então as migrações são aplicadas sozinhas.

### Domínio próprio

1. Na Vercel, abra **Settings → Domains** e adicione o domínio.
2. No provedor de DNS (no nosso caso, a UOL), crie os registros que a Vercel mostrar:
   - **A** para o domínio raiz;
   - **CNAME** para o `www`.

### E-mail (Resend)

1. No Resend, adicione o mesmo domínio.
2. Crie no DNS os registros que ele pedir: DKIM (`resend._domainkey`), SPF (`send`), `rsend` e, opcionalmente, DMARC (`_dmarc`).
3. Depois de verificado, defina `RESEND_API_KEY` e `EMAIL_FROM` na Vercel e faça Redeploy.

### Login com Google

1. No Google Cloud Console, em **APIs e serviços**, configure a tela de consentimento.
2. Crie um **ID do cliente OAuth** do tipo "Aplicativo da Web".
3. Cadastre o URI de redirecionamento `https://www.contasdocasal.com/api/auth/google/callback`.
4. Defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` na Vercel.

## Estrutura

```
prisma/                 schema e migrações (nomes em português)
src/app/(auth)/         login, cadastro, senha, convite (telas públicas)
src/app/(app)/          app logado: visão geral, compras, cartões, contas, renda, casal
src/app/actions*.ts     Server Actions (gravam no banco)
src/app/api/auth/       login com Google (OAuth)
src/components/         componentes de UI e formulários
src/lib/ledger.ts       cálculo das parcelas, divisões e acertos (puro, testado)
src/lib/statement.ts    leitor de faturas PDF/OFX/CSV (puro, testado)
src/lib/receivables.ts  parcelas, pagamentos e cobrança dos valores a receber (puro, testado)
src/lib/goals.ts        progresso das metas e quanto guardar por mês (puro, testado)
src/middleware.ts       protege as rotas que exigem login
```

## Privacidade

- O PDF da fatura é lido **no próprio servidor** com o `unpdf`. Ele não é enviado a nenhum serviço externo e não fica guardado. Só as compras confirmadas na revisão são gravadas.
- A senha do PDF é usada apenas para abrir o arquivo e não é armazenada.
- As senhas das contas são guardadas como hash (bcrypt). Os links de recuperação são de uso único, valem 1 hora e ficam guardados só como hash.
