-- Estorno de movimentação: "desfazer" cria um registro inverso ligado ao
-- original por estornoDeId, em vez de apagar o original. Ver o comentário no
-- model Movimentacao em prisma/schema.prisma.
--
-- Por que reconstruir a tabela em vez de um ALTER TABLE ADD COLUMN: o SQLite
-- não aceita adicionar coluna com FOREIGN KEY nem com UNIQUE. Reconstruir é o
-- que o próprio Prisma gera nesses casos. A tabela é append-only e pequena
-- (dezenas de linhas por dia), então o INSERT ... SELECT abaixo é barato.

PRAGMA foreign_keys=OFF;

CREATE TABLE "novo_Movimentacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "quantidade" DECIMAL NOT NULL,
    "valor" DECIMAL NOT NULL DEFAULT 0,
    "origemDispositivo" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estornoDeId" TEXT,
    CONSTRAINT "Movimentacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movimentacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movimentacao_estornoDeId_fkey" FOREIGN KEY ("estornoDeId") REFERENCES "Movimentacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "novo_Movimentacao" ("id", "produtoId", "usuarioId", "tipo", "motivo", "quantidade", "valor", "origemDispositivo", "criadoEm")
SELECT "id", "produtoId", "usuarioId", "tipo", "motivo", "quantidade", "valor", "origemDispositivo", "criadoEm" FROM "Movimentacao";

DROP TABLE "Movimentacao";
ALTER TABLE "novo_Movimentacao" RENAME TO "Movimentacao";

CREATE INDEX "Movimentacao_produtoId_idx" ON "Movimentacao"("produtoId");
CREATE INDEX "Movimentacao_criadoEm_idx" ON "Movimentacao"("criadoEm");

-- A regra "uma movimentação só é estornada uma vez", no banco. No SQLite um
-- índice único aceita vários NULL, então as movimentações não estornadas
-- (a maioria) convivem sem problema.
CREATE UNIQUE INDEX "Movimentacao_estornoDeId_key" ON "Movimentacao"("estornoDeId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
