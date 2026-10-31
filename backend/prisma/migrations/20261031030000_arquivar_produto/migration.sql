-- Arquivar produto em vez de apagar.
--
-- Coluna anulável e sem constraint, então ALTER TABLE ADD COLUMN basta — não
-- é preciso reconstruir a tabela. Nulo quer dizer "produto em uso", que é o
-- estado de todos os produtos existentes até aqui.
--
-- O porquê de arquivar está no comentário do model Produto em schema.prisma:
-- estoque é a soma das movimentações, e apagar um produto com histórico
-- reescreveria relatórios já conferidos e travaria a fila offline dos
-- aparelhos que ainda tivessem venda daquele produto para enviar.

ALTER TABLE "Produto" ADD COLUMN "arquivadoEm" DATETIME;

-- "Os produtos em uso, em ordem de nome" é a consulta de toda tela de venda.
CREATE INDEX "Produto_arquivadoEm_nome_idx" ON "Produto"("arquivadoEm", "nome");
