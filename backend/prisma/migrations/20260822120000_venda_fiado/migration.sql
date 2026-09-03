-- Venda fiado: a venda passa a registrar COMO foi paga e, quando fiado, PARA
-- QUEM. Ver o comentário no model Movimentacao em prisma/schema.prisma.
--
-- As duas colunas são anuláveis e sem constraint, então ALTER TABLE ADD COLUMN
-- basta — não é preciso reconstruir a tabela como na migration do estorno.
-- Nulo aqui quer dizer "movimentação anterior a esta funcionalidade" (ou que
-- não é venda), e é assim que os relatórios devem lê-lo.

ALTER TABLE "Movimentacao" ADD COLUMN "formaPagamento" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "cliente" TEXT;

-- A consulta da lista de devedores e do filtro por forma de pagamento é
-- sempre "as vendas fiado, da mais recente para a mais antiga".
CREATE INDEX "Movimentacao_formaPagamento_criadoEm_idx" ON "Movimentacao"("formaPagamento", "criadoEm");
