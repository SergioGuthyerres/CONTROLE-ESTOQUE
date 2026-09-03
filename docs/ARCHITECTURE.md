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
   (ver seção 5.2 do documento de visão). O "Desfazer" do histórico não é
   exceção: ele cria a movimentação inversa e a liga à original por
   `estornoDeId` (`backend/src/services/estornoService.ts`).

3. **`tipo` só tem `entrada` e `saida`, nunca um terceiro valor.** Ajuste de
   inventário (contagem física) é `entrada` (achou a mais) ou `saida` (achou
   a menos) com `motivo: "inventario"` — ver `backend/src/lib/enums.ts`.

4. **Fiado dá baixa no estoque igual à venda à vista.** `formaPagamento` só
   diz onde o dinheiro está, não se a mercadoria saiu — ela saiu. Por isso
   nenhuma consulta de estoque olha para esse campo; só os relatórios olham.

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
| Adicionar uma unidade de medida | `backend/src/lib/enums.ts` (`UNIDADES`) + o tipo `Unidade` em `frontend/src/db/db.ts` + o rótulo em `frontend/src/lib/enums.ts`. Não precisa de migration: `unidade` é String no SQLite |
| Mexer nas regras de entrada de uma movimentação (o que é obrigatório, o que é proibido) | `backend/src/lib/movimentacaoSchema.ts` — é puro (só zod + enums), então `backend/testes/vendaFiado.test.ts` exercita as regras sem banco nem servidor. Toda regra nova precisa aceitar movimentação de app antigo, sem o campo |
| Mudar a lista de devedores ou a baixa de fiado | `backend/src/lib/fiado.ts` (regra de "quem ainda deve", pura e testada) + `backend/src/routes/fiado.ts` + `frontend/src/pages/Devedores.tsx`. A baixa é um INSERT em `PagamentoFiado`, nunca um UPDATE na venda |
| Mudar algo em venda fiado | `backend/src/lib/enums.ts` (`FORMAS_PAGAMENTO`, `ehVenda`) + `backend/src/lib/movimentacaoSchema.ts` + `backend/src/services/resumoService.ts` (separação à vista/fiado) + `frontend/src/lib/clientes.ts` (sugestão de nome) |
| Adicionar um novo motivo de movimentação | `backend/src/lib/enums.ts` (`MOTIVOS_MOVIMENTACAO`, `MOTIVOS_POR_TIPO`) + espelhar em `frontend/src/lib/enums.ts` |
| Mudar o texto/aparência de uma tela | `frontend/src/pages/*.tsx` — estilo vem das classes utilitárias em `frontend/src/index.css` (`.botao-grande`, `.campo`, `.cartao`) |
| Resumir vendas/compras de um período | `backend/src/services/resumoService.ts` + a regra de classificação em `backend/src/lib/gruposDeMovimentacao.ts` |
| Mudar os atalhos de produto da tela de venda/compra | `frontend/src/lib/sugestoes.ts` (ordem) + `GET /produtos/mais-movimentados` (o que a loja inteira movimenta) |
| Filtrar por data em qualquer tela | `frontend/src/lib/datas.ts` — a conversão dia→instante é feita no navegador, que é quem conhece o fuso da loja; a API só compara instantes |
| Adicionar um relatório novo | `backend/src/routes/relatorios.ts` + tela em `frontend/src/pages/admin/Relatorios.tsx` |
| Desfazer/corrigir uma movimentação | `backend/src/services/estornoService.ts` (regra, pura e testada) + `POST /movimentacoes/:id/estorno` — nunca um DELETE |
| Mexer na sincronização offline | `frontend/src/lib/sync.ts` — e rodar `cd frontend && npm test` (`frontend/testes/sync.test.ts` cobre fila, catálogo e estoque otimista com IndexedDB em memória) |
| Mudar regra de sessão, permissão ou senha | `backend/src/middleware/auth.ts` (quem passa), `backend/src/services/authService.ts` (token), `backend/src/lib/senha.ts` (força da senha) — e rodar `npm test` |
| Adicionar uma rota nova | Sempre embrulhar handler `async` em `assincrono(...)` de `backend/src/middleware/erros.ts` — sem isso, um erro do Prisma deixa a requisição pendurada (Express 4 não captura promise rejeitada) |
| Publicar uma mudança em produção | Nada a fazer: merge na `main` publica os dois lados (PWA no Cloudflare, API pelo job `deploy da API` em `.github/workflows/ci.yml`). Ver `deploy/README-DEPLOY.md`, seção 9 |

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
