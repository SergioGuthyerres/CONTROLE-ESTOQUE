-- Campos de controle de sessão e senha do Usuario.
-- Ver o comentário no model Usuario em prisma/schema.prisma para o porquê de
-- cada um. Os três são ADD COLUMN com valor padrão, então usuários que já
-- existem no banco continuam válidos e ativos após a migration.

-- ativo: desliga o acesso sem apagar o usuário (as movimentações dele são
-- registro de auditoria e não podem perder o autor).
ALTER TABLE "Usuario" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

-- tokenVersion: incrementar invalida todos os tokens JWT já emitidos para o
-- usuário — é o "deslogar de todos os aparelhos" / celular perdido.
ALTER TABLE "Usuario" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- precisaTrocarSenha: senha definida por outra pessoa (admin criou ou resetou)
-- só permite acessar /auth/eu e /auth/trocar-senha até ser trocada.
ALTER TABLE "Usuario" ADD COLUMN "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT false;
