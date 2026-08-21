-- Índice para o filtro por tipo no histórico (RF13).
--
-- O histórico já filtrava por produto e ordenava por data. Com o filtro de
-- tipo, a consulta mais comum passa a ser "as saídas mais recentes" — sem
-- este índice o SQLite varre a tabela inteira e ordena em memória a cada
-- troca de filtro. A tabela é append-only e só cresce.
CREATE INDEX "Movimentacao_tipo_criadoEm_idx" ON "Movimentacao"("tipo", "criadoEm");
