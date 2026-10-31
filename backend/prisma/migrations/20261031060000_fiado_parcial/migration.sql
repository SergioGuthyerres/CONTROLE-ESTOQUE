-- Pagamento parcial de fiado.
--
-- A primeira versão amarrava um pagamento a cada dívida, com UNIQUE em
-- movimentacaoId: só servia para quem paga tudo de uma vez. O caderno de
-- fiado não funciona assim — o freguês aparece e deixa o que tem.
--
-- Agora uma dívida pode receber várias linhas, e está quitada quando a soma
-- delas cobre o valor da venda.

-- Coluna com default temporário só para conseguir criá-la com NOT NULL numa
-- tabela que já tem linhas; o UPDATE logo abaixo preenche o valor real.
ALTER TABLE "PagamentoFiado" ADD COLUMN "valor" DECIMAL NOT NULL DEFAULT 0;

-- Toda baixa existente era quitação integral: o valor dela é o valor da venda.
UPDATE "PagamentoFiado"
SET "valor" = (
  SELECT "Movimentacao"."valor"
  FROM "Movimentacao"
  WHERE "Movimentacao"."id" = "PagamentoFiado"."movimentacaoId"
);

-- O UNIQUE era a regra "uma dívida só se paga uma vez". Deixa de valer: o que
-- impede pagar além da conta agora é a checagem de saldo na rota, porque o
-- limite é uma soma e não a existência de uma linha.
DROP INDEX "PagamentoFiado_movimentacaoId_key";
CREATE INDEX "PagamentoFiado_movimentacaoId_idx" ON "PagamentoFiado"("movimentacaoId");
