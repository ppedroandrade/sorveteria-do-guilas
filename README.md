# Gestão da Gelateria

Sistema web de gestão para sorveteria artesanal, de uso exclusivo do proprietário: pedidos, clientes, sabores, pagamentos, estoque, agenda de encomendas e relatórios. Interface 100% em português, responsiva (computador, tablet e celular).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · componentes no padrão shadcn/ui (Radix) · Lucide · React Hook Form · Zod · Recharts · Prisma 6 · PostgreSQL · Vitest.

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Instalação local](#instalação-local)
3. [Banco de dados, migrations e seed](#banco-de-dados-migrations-e-seed)
4. [Conta do proprietário](#conta-do-proprietário)
5. [Testes](#testes)
6. [Deploy na Vercel](#deploy-na-vercel)
7. [Arquitetura](#arquitetura)
8. [Regras de negócio](#regras-de-negócio)
9. [Segurança](#segurança)
10. [Pendências e decisões em aberto](#pendências-e-decisões-em-aberto)

---

## Funcionalidades

| Área | O que faz |
|---|---|
| **Dashboard** | Faturamento do dia e do mês, pedidos de hoje, ticket médio, pendentes, aguardando pagamento, vendido × recebido no período, gráfico, sabores mais vendidos, clientes que mais compram, encomendas de hoje/amanhã, estoque baixo, pedidos recentes. Período selecionável (hoje, 7/30 dias, mês, mês passado, personalizado). |
| **Pedidos** | Criação rápida (toque no sabor/tamanho para adicionar), cliente existente, novo (sem sair do pedido) ou avulso, retirada/entrega com taxa, data/hora prevista, desconto em R$ ou %, forma de pagamento, “já recebi o pagamento”, observações por pedido e por item. Kanban com arrastar e soltar + botões de avanço; lista com filtros (status, pagamento, cliente, período) e busca por número/cliente/telefone; detalhes com histórico de status; editar; duplicar; cancelar com motivo; comprovante para impressão; resumo para WhatsApp (copiar ou abrir `wa.me`). |
| **Agenda** | Encomendas futuras agrupadas por dia (14 dias por página). |
| **Clientes** | Cadastro, busca por nome/telefone, histórico de pedidos, total gasto, nº de compras, ticket médio, última compra, saldo em aberto, sabores favoritos, “repetir pedido”, arquivamento (soft delete). |
| **Produtos e sabores** | Cadastro/edição, categoria, descrição, imagem opcional, vegano, disponível para venda, apresentações com preço individual, desativação (soft delete), controle de estoque opcional. |
| **Estoque** | Saldo por produto, mínimo, alertas, entradas, saídas manuais, ajustes de contagem, histórico de movimentações (inclusive baixas por pedido). |
| **Financeiro** | Vendido × recebido × a receber, reembolsos, recebimentos por forma de pagamento, produtos com maior faturamento, pedidos com saldo em aberto, últimos lançamentos. |
| **Relatórios** | Vendas por dia/semana/mês, sabores mais e menos vendidos, receita por sabor e por tamanho, ranking de clientes, frequência, clientes sem compras recentes (30/60/90 dias). Exportação CSV (padrão Excel pt-BR). |
| **Configurações** | Nome, logotipo, telefone, endereço, moeda, fuso horário, taxa de entrega padrão, textos do comprovante, apresentações (tamanhos) globais, categorias, troca de senha. |

### Catálogo inicial

O seed cadastra os 14 sabores informados, cada um com duas apresentações — **“Tamanho 1”** e **“Tamanho 2”** — com os respectivos preços. Morango com geleia de frutas vermelhas e Manga com caramelo de maracujá estão marcados como **veganos**. Os nomes reais dos tamanhos não foram informados, então **não foram presumidos** (ex.: 500 ml / 1 L): renomeie em *Configurações → Apresentações* (vale para todos os sabores) ou use “Nome neste produto” em um sabor específico.

As categorias (Tradicionais, Especiais, Frutados, Veganos, Edições limitadas) foram atribuídas como **sugestão inicial** e podem ser trocadas em cada sabor.

---

## Instalação local

Pré-requisitos: **Node.js ≥ 20.9** e **PostgreSQL ≥ 14**.

```bash
npm install
```

```bash
cp .env.example .env
```

Edite o `.env`:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão usada pela aplicação. Em produção, use a URL **com pooling** do provedor. |
| `DIRECT_URL` | Conexão direta (sem pooler) usada pelas migrations. Localmente, igual à `DATABASE_URL`. |
| `TEST_DATABASE_URL` | Banco **exclusivo** para testes de integração (é limpo a cada teste). Nunca aponte para o banco real. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Conta do proprietário criada pelo seed (senha com 8+ caracteres). |

Crie os bancos (exemplo com `psql`):

```bash
createdb gelateria && createdb gelateria_test
```

Aplique as migrations, popule o catálogo e inicie:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Acesse http://localhost:3000 e entre com o e-mail/senha definidos no `.env`.

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários + integração |
| `npm run db:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run db:deploy` | Aplica migrations pendentes (produção) |
| `npm run db:seed` | Seed idempotente (catálogo + conta) |
| `npm run db:studio` | Prisma Studio |
| `npm run create-admin` | Cria a conta ou redefine a senha do proprietário |

---

## Banco de dados, migrations e seed

- Schema: `prisma/schema.prisma`. Migrations versionadas em `prisma/migrations/` (inclui `CHECK constraints` de integridade: preço ≥ 0, quantidade > 0, pagamento > 0, desconto ≤ subtotal).
- Dinheiro em **centavos (inteiros)**; quantidades de estoque em **milésimos da unidade** (1,5 L = 1500). Sem erros de ponto flutuante.
- O seed (`prisma/seed.ts`) é **idempotente**: pode rodar várias vezes sem duplicar sabores e **sem sobrescrever** preços/nomes já editados.
- Os dados ficam no PostgreSQL — reiniciar o servidor não perde nada. Nada é guardado em `localStorage` (apenas a preferência visual de menu recolhido).

Entidades: `User`, `Session`, `BusinessSettings`, `Presentation`, `Category`, `Product`, `ProductVariant`, `Customer`, `Order`, `OrderItem`, `OrderStatusHistory`, `Payment`, `InventoryMovement`.

---

## Conta do proprietário

O seed cria a conta a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Para criar depois ou redefinir a senha (a senha é pedida no terminal e não fica no histórico):

```bash
npm run create-admin -- --email dono@suagelateria.com --name "Seu Nome"
```

Redefinir a senha encerra todas as sessões abertas. A senha também pode ser trocada em *Configurações → Acesso*.

---

## Testes

```bash
npm test
```

- **Unitários** (`tests/unit`): cálculo de totais, descontos (R$ e %, arredondamento, limites), situação financeira (parcial, múltiplas formas, reembolso), regras de lançamento (excesso, pedido cancelado), regra de estoque (idempotência, edição, cancelamento), datas no fuso do negócio, CSV (injeção de fórmula), mensagem/link de WhatsApp, proteção de rotas (middleware).
- **Integração** (`tests/integration`, PostgreSQL real em `TEST_DATABASE_URL`): criação de pedido com múltiplos produtos; preservação do preço histórico; edição mantendo preços originais; bloqueio de produto indisponível/desativado; idempotência contra clique duplo simultâneo; pagamentos parciais em PIX + dinheiro; excesso e duplicidade de pagamento; cancelamento fora das vendas e do “a receber”; reembolso; baixa/estorno de estoque sem duplicidade; bloqueio de estoque negativo; concorrência (8 pedidos simultâneos para 5 L → exatamente 5 aceitos); sessões (hash do token, expiração, token inválido).

Sem `TEST_DATABASE_URL`, os testes de integração são ignorados (os unitários rodam normalmente). O setup aplica as migrations com `prisma migrate deploy` e cada suíte limpa as tabelas **apenas** do banco de testes (há uma trava que recusa limpar se `DATABASE_URL` ≠ `TEST_DATABASE_URL`).

---

## Deploy na Vercel

1. Crie um banco PostgreSQL gerenciado (ex.: **Neon**, **Supabase**, Vercel Postgres/Neon, Railway).
2. Importe o repositório na Vercel (framework detectado: Next.js).
3. Em *Settings → Environment Variables*, defina:
   - `DATABASE_URL` — URL **pooled** (Neon: host com `-pooler`; Supabase: porta 6543 com `?pgbouncer=true`).
   - `DIRECT_URL` — URL direta (sem pooler), usada pelas migrations.
4. O script `vercel-build` (usado automaticamente pela Vercel) roda `prisma generate`, **`prisma migrate deploy`** e `next build`.
5. Rode o seed uma vez apontando para o banco de produção (da sua máquina):

```bash
DATABASE_URL="<url-direta-de-producao>" DIRECT_URL="<url-direta-de-producao>" ADMIN_EMAIL="voce@dominio.com" ADMIN_PASSWORD="<senha-forte>" npm run db:seed
```

Não é necessário nenhum serviço externo além do PostgreSQL: imagens de produto e logotipo são reduzidas no navegador e guardadas no banco; o WhatsApp usa links `wa.me` (sem integração paga).

---

## Arquitetura

```
prisma/                schema, migrations, catálogo e seed
src/middleware.ts      1ª barreira de autenticação (cookie) — Edge
src/app/login          tela de login
src/app/(app)/         área autenticada (layout valida sessão no banco)
  page.tsx             dashboard
  pedidos/ agenda/ clientes/ produtos/ estoque/ financeiro/ relatorios/ configuracoes/
src/app/api/relatorios exportação CSV (valida sessão)
src/server/actions/    Server Actions: sessão → Zod → serviço → revalidação
src/lib/domain/        regras puras e testáveis (totais, pagamentos, estoque, WhatsApp, rótulos)
src/lib/services/      acesso a dados e operações transacionais (pedidos, pagamentos, estoque, relatórios)
src/lib/validation.ts  schemas Zod compartilhados entre formulário e servidor
src/components/        UI (ui/ = base estilo shadcn; orders/, products/, … = telas)
tests/                 unitários e integração
```

Decisões principais:

- **Server Components** para leitura (sem API intermediária) e **Server Actions** para escrita; toda action revalida a sessão e os dados com Zod no servidor, mesmo que o formulário já valide no cliente.
- **Camada de domínio pura** (`src/lib/domain`) — a mesma função calcula o total no formulário e no servidor; o servidor é a fonte da verdade.
- **Fuso horário do negócio** (padrão `America/Sao_Paulo`, configurável): “hoje”, “mês”, agrupamentos e horários agendados são calculados nesse fuso, não no do servidor (a Vercel roda em UTC).
- **Autenticação própria e enxuta** (sem NextAuth): só existe um perfil (proprietário), então sessões em banco com cookie `httpOnly` cobrem o requisito com menos dependências.

---

## Regras de negócio

**Totais.** `subtotal = Σ preço × quantidade`; desconto (R$ ou %) incide só sobre os produtos, nunca sobre a taxa de entrega, e não pode exceder o subtotal; `total = subtotal − desconto + taxa`. Em retirada, a taxa é zerada.

**Preço histórico.** Cada item guarda nome do sabor, nome da apresentação, preço unitário e consumo de estoque **no momento da venda**. Mudanças no catálogo não alteram pedidos existentes. Ao editar um pedido, itens já existentes mantêm o preço original; itens novos usam o preço atual. Duplicar um pedido usa os preços atuais e avisa se algum preço mudou ou se algum sabor está indisponível.

**Status.** Pendente → Em preparação → Pronto → Entregue/Retirado (pode voltar em caso de engano). Cancelado é final. Toda mudança fica no histórico. Pedidos entregues ou cancelados não podem ser editados.

**Financeiro.**
- *Vendido* = pedidos **não cancelados** criados no período (competência).
- *Recebido* = pagamentos − reembolsos com data de pagamento no período (caixa).
- *A receber* = total − líquido pago dos pedidos não cancelados.
- Situação: **Pendente**, **Parcialmente pago**, **Pago**, **Reembolsado** — derivada dos lançamentos (vários por pedido e de formas diferentes).
- Pagamento não pode exceder o saldo (troco não entra no caixa); reembolso não pode exceder o recebido; pedido cancelado não recebe pagamento, mas aceita reembolso. Se o pedido for editado para um valor menor que o já pago, a tela avisa o excedente.
- Receita por produto/tamanho = valor bruto dos itens (antes do desconto geral do pedido).

**Estoque (opcional, por produto).**
- O proprietário define a unidade (litro, kg, pote…) e, **para cada apresentação**, quanto do estoque uma unidade vendida consome. Sem essa conversão o produto não pode ser vendido — o sistema **não inventa conversões**.
- Regra única de baixa: o consumo devido pelo pedido é recalculado a partir dos itens (zero se cancelado) e comparado com as movimentações já lançadas para aquele pedido; só a diferença é lançada. Criar, editar, cancelar ou mudar status várias vezes nunca baixa em dobro. Mudança de status não mexe no estoque.
- Com “permitir estoque negativo” desligado, o pedido é recusado quando faltar estoque (a transação inteira é desfeita).

**Duplicidade.** Pedidos e pagamentos levam uma chave de idempotência gerada pelo formulário: clique duplo ou reenvio retorna o mesmo registro. Operações sobre o mesmo pedido travam a linha (`SELECT … FOR UPDATE`) para evitar condições de corrida.

---

## Segurança

- Senhas com **bcrypt** (custo 12). Bloqueio de 15 min após 5 tentativas erradas; mensagem genérica (“e-mail ou senha incorretos”) e tempo de resposta equivalente quando o e-mail não existe.
- Sessão: token aleatório de 256 bits em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; no banco fica apenas o **SHA-256** do token. Expira em 30 dias, renovação automática, sessões vencidas são removidas.
- Proteção em camadas: middleware (sem cookie → login/401), layout autenticado, **toda** server action e rota de API validam a sessão no banco.
- Redirecionamento pós-login só aceita caminhos internos (evita open redirect).
- Validação Zod no servidor + `CHECK constraints` no PostgreSQL.
- CSV protegido contra injeção de fórmulas; cabeçalhos `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Nenhuma credencial no código: tudo por variáveis de ambiente.

---

## Pendências e decisões em aberto

Itens que dependem de informação do proprietário ou ficaram fora do escopo:

1. **Nomes e capacidades dos tamanhos** — hoje “Tamanho 1” e “Tamanho 2”. Basta renomear em *Configurações*.
2. **Conversões de estoque** — o controle está desligado em todos os sabores até que unidade e consumo por tamanho sejam informados.
3. **Categorias** — atribuição inicial é sugestão; revisar.
4. **PDF** — não implementado; o comprovante é otimizado para impressão (o navegador permite “Salvar como PDF”) e os relatórios exportam CSV.
5. **Edição de pedido entregue** — bloqueada por segurança; para corrigir, volte o status para “Pronto”.
6. **Multiusuário/permissões** — fora do escopo (uso exclusivo do proprietário). O modelo `User` já permite adicionar contas via `create-admin`.
7. **Backups** — dependem do provedor do PostgreSQL (Neon/Supabase oferecem backup automático/PITR); recomenda-se ativá-los.
8. **Imagens** — guardadas no banco já reduzidas (~30–80 KB). Para catálogos muito grandes, considerar storage externo (ex.: Vercel Blob).
