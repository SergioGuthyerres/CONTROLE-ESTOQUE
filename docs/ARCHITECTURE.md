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
- `src/lib/sync.ts` tenta sincronizar quando o navegador fica online, a cada
  60s, e ao logar. Sempre que sincroniza com sucesso, também baixa de novo
  produtos/categorias (`baixarCatalogo`) pra atualizar o cache local.
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

## Coisas que foram decididas de propósito e podem parecer estranhas

- **Sem preço fixo no Produto.** O valor pago varia a cada compra, então o
  "valor em estoque" usa custo médio calculado das entradas
  (`calcularValorTotalEstoque`), não um campo `preco`.
- **SQLite no backend, não Postgres.** Orçamento zero + volume pequeno
  (50+ produtos, 50-150 mov/dia) não justificam a complexidade operacional
  de um banco separado. Backup é só copiar o arquivo (`npm run backup`).
- **PWA, não app nativo.** Distribuir na App Store exige conta paga da Apple
  (~US$99/ano), o que contradiz o orçamento quase zero do projeto.
