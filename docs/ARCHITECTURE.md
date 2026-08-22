# Arquitetura — leitura rápida pra quem vai mexer no código

Este arquivo é o atalho. Para o "porquê" completo de cada decisão, ver
[documento-de-visao.md](./documento-de-visao.md) e
[especificacao-requisitos.md](./especificacao-requisitos.md).

## As 3 regras que não podem ser quebradas

1. **Estoque nunca é um número salvo — é sempre a soma das movimentações.**
   `backend/src/services/stockService.ts` é o único lugar que calcula
   estoque. Se você adicionar uma feature que "ajusta o estoque", ela deve
   criar uma nova linha em `Movimentacao`, nunca escrever num campo de saldo.

2. **`Movimentacao` é append-only.** Não existe rota PUT/DELETE para
   movimentação, de propósito. Uma correção é sempre um novo registro. Isso é
   o que permite sincronizar dois dispositivos sem conflito de sobrescrita
   (ver seção 5.2 do documento de visão).

3. **`tipo` só tem `entrada` e `saida`, nunca um terceiro valor.** Ajuste de
   inventário (contagem física) é `entrada` (achou a mais) ou `saida` (achou
   a menos) com `motivo: "inventario"` — ver `backend/src/lib/enums.ts`.

## Como as peças se conectam

```
frontend/ (PWA React)                    backend/ (API Express + Prisma)
├─ Dexie (IndexedDB)  ──┐                ├─ SQLite (arquivo único)
│  cache local de       │  POST /movimentacoes/sync
│  produtos/categorias, │  (fila offline, idempotente por id)
│  fila de movimentações│
│  ainda não enviadas   │  GET /produtos, /categorias, /dashboard, ...
└────────────────────── ┴──────────────> (via fetch, ver src/lib/api.ts)
```

- O funcionário usa o app **offline por padrão**. Toda entrada/saída vira uma
  linha em `db.movimentacoes` (Dexie) com `sincronizada: 0`.
- `src/lib/sync.ts` tenta sincronizar ao logar, quando o navegador fica
  online, quando o app volta ao primeiro plano (`visibilitychange`) e a cada
  60s. Um ciclo tem **duas metades independentes**: subir a fila
  (`enviarMovimentacoesPendentes`) e baixar o catálogo (`baixarCatalogo`).
  Elas precisam continuar independentes — quando baixar o catálogo era a
  última linha do envio, um aparelho sem fila pendente nunca recebia o que
  foi cadastrado em outro celular, e só sair da conta e entrar de novo
  resolvia.
- O admin também pode usar entrada/saída offline, mas dashboard/relatórios/
  histórico exigem internet (não fazem sentido offline — são leitura
  agregada do servidor).

## O limite de 20 unidades (RF07)

Vendas grandes (`tipo: saida`, `quantidade > 20`) exigem estar online: o app
consulta `GET /produtos/:id/estoque` no servidor antes de deixar confirmar.
O valor `20` **não está hardcoded nos dois lados** — o backend expõe em
`GET /config` (`LIMITE_QUANTIDADE_ONLINE` no `.env`) e o frontend busca/cacheia
esse valor (`frontend/src/lib/config.ts`). Pra mudar o limite, troque só a
variável de ambiente do backend.

## Onde mexer para cada tipo de mudança

| Quero... | Vou mexer em |
|---|---|
| Mudar regra de cálculo de estoque | `backend/src/services/stockService.ts` |
| Adicionar um campo no produto | `backend/prisma/schema.prisma` (rodar `npm run prisma:migrate`) + `backend/src/routes/produtos.ts` + `frontend/src/db/db.ts` + telas de cadastro |
| Adicionar um novo motivo de movimentação | `backend/src/lib/enums.ts` (`MOTIVOS_MOVIMENTACAO`, `MOTIVOS_POR_TIPO`) + espelhar em `frontend/src/lib/enums.ts` |
| Mudar o texto/aparência de uma tela | `frontend/src/pages/*.tsx` — estilo vem das classes utilitárias em `frontend/src/index.css` (`.botao-grande`, `.campo`, `.cartao`) |
| Adicionar um relatório novo | `backend/src/routes/relatorios.ts` + tela em `frontend/src/pages/admin/Relatorios.tsx` |
| Mexer na sincronização offline | `frontend/src/lib/sync.ts` — e rodar `cd frontend && npm test` (`frontend/testes/sync.test.ts` cobre fila, catálogo e estoque otimista com IndexedDB em memória) |
| Mudar regra de sessão, permissão ou senha | `backend/src/middleware/auth.ts` (quem passa), `backend/src/services/authService.ts` (token), `backend/src/lib/senha.ts` (força da senha) — e rodar `npm test` |
| Adicionar uma rota nova | Sempre embrulhar handler `async` em `assincrono(...)` de `backend/src/middleware/erros.ts` — sem isso, um erro do Prisma deixa a requisição pendurada (Express 4 não captura promise rejeitada) |
| Publicar uma mudança em produção | `deploy/README-DEPLOY.md`, seção "Atualizando o sistema depois" |

## Coisas que foram decididas de propósito e podem parecer estranhas

- **Sem preço fixo no Produto.** O valor pago varia a cada compra, então o
  "valor em estoque" usa custo médio calculado das entradas
  (`calcularValorTotalEstoque`), não um campo `preco`.
- **SQLite no backend, não Postgres.** Orçamento zero + volume pequeno
  (50+ produtos, 50-150 mov/dia) não justificam a complexidade operacional
  de um banco separado. O backup (`npm run backup`) usa `VACUUM INTO` em vez de
  copiar o arquivo — copiar um SQLite em uso gera backup possivelmente corrompido.
- **Token de 30 dias, mas verificado no banco a cada requisição.** A validade
  longa vem do RNF05 (login frequente é atrito para o público do sistema); a
  consulta por requisição é o que permite revogar acesso na hora via
  `Usuario.ativo` e `Usuario.tokenVersion`. Nesta escala o custo é irrelevante.
- **Token guardado em `localStorage`, não em cookie httpOnly.** O PWA e a API
  ficam em domínios diferentes (Cloudflare Pages e VPS), o que tornaria o cookie
  bem mais complicado. A contrapartida é a CSP restritiva gerada em
  `frontend/scripts/gerar-headers.mjs`, que bloqueia script de terceiro — se um
  dia o app e a API forem servidos do mesmo domínio, vale migrar para cookie.
- **PWA, não app nativo.** Distribuir na App Store exige conta paga da Apple
  (~US$99/ano), o que contradiz o orçamento quase zero do projeto.
