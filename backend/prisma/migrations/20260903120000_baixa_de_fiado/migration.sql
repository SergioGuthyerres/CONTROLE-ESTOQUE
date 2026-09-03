-- Dar baixa num fiado.
--
-- Tabela nova em vez de uma coluna `pago` na Movimentacao: Movimentacao é
-- append-only (ver docs/ARCHITECTURE.md, regra 2). Um UPDATE marcando "pago"
-- não guardaria quem deu baixa nem quando — que é exatamente o que a loja
-- precisa saber no dia em que o freguês diz que já pagou.
--
-- O UNIQUE em movimentacaoId é a regra de negócio no banco: a mesma dívida não
-- pode ser baixada duas vezes. Sem ele, dois cliques no botão (ou dois
-- aparelhos ao mesmo tempo) criariam dois recibos para o mesmo fiado.

CREATE TABLE "PagamentoFiado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movimentacaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagamentoFiado_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PagamentoFiado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PagamentoFiado_movimentacaoId_key" ON "PagamentoFiado"("movimentacaoId");
CREATE INDEX "PagamentoFiado_criadoEm_idx" ON "PagamentoFiado"("criadoEm");
CREATE INDEX "PagamentoFiado_cliente_idx" ON "PagamentoFiado"("cliente");
