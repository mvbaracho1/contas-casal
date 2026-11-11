# AGENTS.md: regras e padrões do projeto

Guia para quem altera o código, seja pessoa ou agente de IA. O que o app faz e como rodar está no [README.md](README.md).

## Idioma

- **Tudo em português do Brasil:** textos da interface, mensagens de erro, comentários, nomes de migração, mensagens de commit e respostas ao usuário.
- Identificadores de código (variáveis, funções, tipos) ficam em inglês, como no resto do código (`installments`, `payerSharePct`).
- Rotas são em português: `/compras/importar`, `/esqueci-senha`, `/convite/[code]`.

## Antes de dar uma tarefa por concluída

```bash
pnpm tsc --noEmit   # tipos
pnpm lint           # ESLint
pnpm test           # Vitest (ledger + leitor de faturas)
```

- Mudou configuração, dependência ou import de pacote? Rode também o `next build`.
  - No Windows, rode a partir de `C:\` maiúsculo (veja "Armadilhas").
  - O deploy já quebrou por cliente Prisma desatualizado, e por isso o `build` roda `prisma generate`.
- Mudou tela? Confira no celular (390px) e no desktop (1440px), sem rolagem horizontal, no tema claro e no escuro.

## Stack e versões

- Next.js **15** com App Router, Server Actions e middleware no Edge.
- React **19**.
- Prisma **6** com Postgres. Localmente o banco roda no Docker, na porta 5434. Na Vercel, no Neon.
- Tailwind CSS **4**. A configuração fica no CSS (`@theme` e `@custom-variant dark` em `globals.css`). Não existe `tailwind.config`.
- Validação com **zod 4**, sessão JWT com **jose**, leitura de PDF com **unpdf**.
- Gerenciador de pacotes: **pnpm**. Não use npm nem yarn.

## Estrutura e onde colocar cada coisa

| Onde | O quê |
|---|---|
| `src/lib/ledger.ts` | **Lógica pura** de dinheiro: parcelas, divisões, renda e acerto. Sem banco e sem React. Toda regra de cálculo vai aqui, com teste em `ledger.test.ts` |
| `src/lib/statement.ts` | **Leitor puro** de faturas (texto de PDF, OFX, CSV). Testes em `statement.test.ts` |
| `src/lib/goals.ts` | **Lógica pura** das metas: progresso, quanto guardar por mês até o prazo, contribuição de cada um. Testes em `goals.test.ts` |
| `src/lib/receivables.ts` | **Lógica pura** dos valores a receber: parcelas, distribuição dos pagamentos, status e mensagem de cobrança. Testes em `receivables.test.ts` |
| `src/lib/finance.ts` | Funções puras de apresentação e de cartão (`splitLabel`, `cardInvoice`, cores) |
| `src/lib/*-data.ts`, `db.ts`, `auth.ts`, `mail.ts`… | Código **só de servidor** (`import "server-only"`) |
| `src/app/actions*.ts` | Server Actions (`"use server"`), separadas por assunto: `actions.ts` (auth, casal, compras, acertos), `actions-finance.ts` (renda, cartões, contas fixas), `actions-password.ts`, `actions-import.ts` |
| `src/app/(app)/` | Telas logadas, que usam o layout com menu |
| `src/app/(auth)/` | Telas públicas, com o layout da marca |
| `src/components/` | Componentes. Formulários são `"use client"` |
| `prisma/migrations/` | Migrações SQL versionadas |

## Dinheiro, datas e meses

- **Dinheiro é sempre inteiro em centavos** (`amountCents`, `totalCents`). Nunca use float para guardar valores.
  - Para converter, use `parseBRL()` (texto para centavos) e `formatBRL()` (centavos para "R$ 1.234,56").
  - Para dividir em parcelas, use `splitInstallments()`: os centavos que sobram vão nas primeiras parcelas.
- **Mês é string `"YYYY-MM"`** (tipo `Ym`). Para operar com meses, use `addMonths`, `ymToIndex`, `currentYm` e `formatYm`. Não use `Date` para isso.
- **Data de compra** é gravada como `new Date("YYYY-MM-DDT12:00:00Z")`. O meio-dia UTC evita que o fuso troque o dia.
- **Compra parcelada:**
  - `firstMonth` é o mês da fatura da **parcela 1**, e `installments` é o total de parcelas.
  - `startInstallment` diz a partir de qual parcela a compra entra nas contas. As anteriores foram pagas antes do app e não geram linhas.
  - Uma linha "3/10" da fatura de dezembro vira `firstMonth = outubro`, `startInstallment = 3`.
- **Compra recorrente (assinatura):** `recurring = true`, sempre com 1 parcela. O valor cheio se repete todo mês de `firstMonth` até `endMonth` (ou sem fim), via `recurringActive()`. Na importação, uma assinatura já cadastrada é reconhecida em toda fatura em que estiver ativa. No limite do cartão, conta só a cobrança do mês. Compra de amigo não pode ser recorrente.
- **Divisão (`payerSharePct`)** é o % de quem pagou. `null` significa **proporcional à renda do casal naquele mês**, via `incomeSharePct`. Sem renda cadastrada, fica 50/50. Vale para compras e contas fixas.
- **Valores a receber (`Receivable`)** são só controle: não entram em `summarizeMonth`, no saldo nem no acerto.
  - Na visão geral, as compras de amigos ficam **à parte**: fora do saldo previsto e de "Compras do mês", mostradas no card "Compras de amigos". Só a fatura do cartão e "Contas a pagar" usam o valor cheio, porque é o que o banco cobra.
  - Uma compra de amigo no cartão é uma `Purchase` com `payerSharePct = 100`, para ficar toda com o titular, mais um `Receivable` ligado por `purchaseId`.
  - Os valores do `Receivable` acompanham a compra. Use `syncPurchaseReceivable()` (`lib/receivable-sync.ts`) sempre que salvar uma compra.
  - Não deixe desligar o amigo de uma compra que já tem pagamentos registrados.
  - Os pagamentos são distribuídos da parcela mais antiga para a mais nova.
- **Nada que gere custo:** cobrança é por link `wa.me` ou mensagem copiada. Não use APIs pagas (WhatsApp Business, SMS, IA) sem decisão do dono do projeto.
- Mudou alguma regra de cálculo? **Escreva o teste junto**, no estilo dos testes que já existem.

## Servidor x cliente e segurança

- **Credenciais e segredos ficam só no servidor.** Nunca crie variável `NEXT_PUBLIC_` com segredo. `db.ts` tem `import "server-only"`: importar o banco em componente cliente quebra o build, e isso é intencional.
- Um arquivo `"use server"` **só pode exportar funções async**, e **toda função exportada vira um endpoint público**.
  - Helpers internos vão para `src/lib/`. Exemplo: `findValidResetToken` fica em `lib/password-reset.ts`.
  - Não exporte constantes desses arquivos.
- **Toda action e toda página logada começa com `requireUser()` ou `requireCouple()`.** Essas funções redirecionam quem não tem permissão.
- **Toda consulta filtra por `coupleId` do casal logado.** Para atualizar ou apagar, use `updateMany`/`deleteMany` com `{ id, coupleId }`, nunca só pelo `id`. Valide também a posse:
  - o cartão precisa ser do casal;
  - o titular do cartão precisa ser quem pagou;
  - quem pagou precisa ser um dos `memberIds`.
- **Valide a entrada com zod** nas actions. Nunca confie em campos ocultos nem em JSON vindo do cliente.
- **URL pública:** use `appUrl()` (`lib/app-url.ts`). Nunca monte links de e-mail com o cabeçalho `Host`, que pode ser forjado.
- **Rotas públicas:** quem não está logado só acessa as rotas listadas em `PUBLIC` no `src/middleware.ts`. `OPEN` é a lista de rotas acessíveis com ou sem login, como o link de convite. Toda tela pública nova precisa entrar numa dessas listas.
- **E-mail:** use `sendMail()` de `lib/mail.ts`. Sem Resend, em desenvolvimento o e-mail aparece no terminal. Em produção, o envio falha e quem chamou trata o erro.
- **Código de acesso do cadastro (`lib/signup-code.ts`):** toda criação de conta **sem convite válido** passa por `checkSignupCode()`, inclusive no retorno do Google, senão a regra é contornada. Ele limita 10 tentativas erradas por IP a cada 15 minutos. Em produção, sem `SIGNUP_CODE`, o cadastro fica fechado. Nunca coloque o código no código-fonte.
- **Respostas que não revelam dados:** a recuperação de senha responde igual exista o e-mail ou não. Mantenha esse padrão.
- **Faturas não saem do servidor:** não envie o conteúdo de faturas para serviços externos, IA inclusive, sem decisão explícita do dono do projeto.

## Padrões de Server Actions e formulários

- Assinatura: `async function acao(_: FormState, form: FormData): Promise<FormState>`, com `FormState = { error?: string; ok?: string } | undefined`.
- Em caso de sucesso, chame `revalidatePath("/", "layout")` (ou a rota afetada) e depois `redirect(...)` ou `return { ok }`.
- No cliente, use `useActionState(acao, undefined)` com `<Submit>` e `<Message state={state} />` de `components/form-bits.tsx`.
- **O React 19 limpa o formulário depois de cada envio.** Campos que o usuário não deve perder quando dá erro (e-mail, senha, nome) precisam ser **controlados** com `useState`. Campos de arquivo também: guarde o `File` no estado.
- **Toast de sucesso:** toda action que grava algo chama `await flash("Mensagem curta")` (`lib/flash.ts`) antes do `redirect`/`revalidatePath("/", "layout")`. O `<Toaster />` (no layout raiz) mostra o aviso e apaga o cookie. Erros continuam inline no formulário com `{ error }`. Não repita o sucesso inline: devolva `{}` em vez de `{ ok }`. A exceção é a tela de "esqueci a senha", que troca de conteúdo.
- Para enviar listas complexas, como na importação, mande um campo oculto `payload` com JSON e valide com zod no servidor.

## Interface

- **Mobile first.**
  - O app logado tem uma barra de navegação fixa embaixo no celular. O `main` tem `pb-28` e elementos *sticky* no rodapé usam `bottom-24 lg:bottom-4`.
  - Teste sempre em 390px de largura.
- **Use as classes de `globals.css`:** `card`, `card-title`, `muted`, `label`, `input`, `btn`, `btn-outline`, `btn-ghost`, `btn-icon`, `btn-danger`, `pill`. Só crie estilo novo se nenhuma delas servir.
- **Tema escuro** funciona pela classe `.dark` no `<html>`. Todo componente novo precisa das variantes `dark:`.
- Componentes prontos:
  - `PageHeader` para o topo das páginas;
  - `Avatar`, com a cor definida pelo índice da pessoa no casal;
  - `Money`, `Illustration` e `pct` (`components/ui.tsx`);
  - ícones em `components/icons.tsx`.
- Valores em tabela usam a classe `tabular`. Textos longos usam `truncate` com `min-w-0` no pai, para não estourar o layout.
- **Carregamento:**
  - `(app)/loading.tsx` mostra o esqueleto da página;
  - `components/nav-progress.tsx` mostra a barra no topo;
  - botões de envio usam `<Submit>`, que mostra "Salvando…".

## Banco e migrações

- **Nunca edite uma migração já aplicada.** Para mudar o banco, crie uma nova.
- O nome segue o padrão `YYYYMMDDHHMMSS_descricao_em_portugues`, por exemplo `20261111140000_compra_pela_renda`.
- O `prisma migrate dev` é interativo e não funciona em terminal não interativo. Nesse caso, gere o SQL com `prisma migrate diff`:
  ```bash
  pnpm prisma migrate diff --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "postgresql://postgres:postgres@localhost:5434/shadow_tmp" --script
  ```
  Salve o resultado em `prisma/migrations/<nome>/migration.sql` e aplique com `pnpm prisma migrate deploy`.
- Coluna nova em tabela que já tem dados precisa de `DEFAULT` ou ser opcional.
- Na Vercel, o `pnpm build` aplica as migrações sozinho.

## Leitor de faturas (`lib/statement.ts`)

- Ele é **genérico**, sem um leitor por banco. Uma linha de compra começa com data e termina com valor no formato brasileiro (`1.234,56`).
- Uma mesma linha pode ter mais de uma compra, porque algumas faturas têm duas colunas.
- Tudo depois de títulos como "Parcelamentos Próxima Fatura" é ignorado (`FUTURE_SECTION`).
- Errou com algum banco? **Adicione a linha problemática como teste** em `statement.test.ts`, corrija e confira se os outros testes continuam passando.
- Faturas reais para teste vão em `faturas-exemplo/`, que está no `.gitignore`. **Nunca faça commit de fatura real.**

## Git

- **Commit e push só quando o dono do projeto pedir.** Um push na `main` dispara o deploy em produção.
- Mensagens de commit em português, curtas e descrevendo o que mudou.
- Nunca faça commit de `.env`, faturas, dados reais ou credenciais.

## Armadilhas conhecidas

- **Windows, `c:` x `C:`:** se o terminal estiver em `c:\...` com c minúsculo, o Next carrega módulos duas vezes. O resultado é o erro *"Could not find the module … in the React Client Manifest"* no dev, ou *"<Html> should not be imported…"* no build. Rode a partir de `C:\` maiúsculo e apague a pasta `.next`.
- **Um `next dev` por vez:** dois servidores na mesma pasta compartilham o `.next` e corrompem o cache. O sintoma é o erro *"Could not find the module … in the React Client Manifest"*, até em módulos internos do Next. Para testar em outra porta com o `pnpm dev` aberto, use outra pasta: `NEXT_DIST_DIR=.next-teste pnpm next dev -p 3200`. Esse servidor acrescenta a pasta ao `tsconfig.json`: desfaça com `git checkout -- tsconfig.json` e apague a pasta depois do teste. Se o erro aparecer, pare todos os servidores e apague `.next`.
- **Prisma `EPERM` no Windows:** com algum `pnpm dev` aberto, o `prisma generate` não consegue trocar a DLL do engine. Os tipos são gerados mesmo assim. Para regenerar tudo, pare os servidores antes.
- **Vercel e cache:** o `postinstall` pode não rodar quando o build reaproveita o cache. Por isso o script `build` chama `prisma generate` explicitamente. Não remova.
- **Limite de upload:** as Server Actions aceitam até 5 MB (`next.config.ts`) e a Vercel até 4,5 MB. A tela de importação limita o arquivo a 4 MB.
