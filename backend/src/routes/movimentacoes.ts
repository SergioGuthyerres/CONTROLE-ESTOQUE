import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { MOTIVOS_POR_TIPO, TIPOS_MOVIMENTACAO, MOTIVOS_MOVIMENTACAO } from "../lib/enums";

export const movimentacoesRouter = Router();
movimentacoesRouter.use(exigirAutenticacao);

const movimentacaoSchema = z
  .object({
    id: z.string().uuid(), // gerado no cliente — permite sincronização idempotente
    produtoId: z.string().min(1),
    tipo: z.enum(TIPOS_MOVIMENTACAO),
    motivo: z.enum(MOTIVOS_MOVIMENTACAO),
    quantidade: z.number().positive(),
    valor: z.number().nonnegative().default(0),
    origemDispositivo: z.string().min(1),
    criadoEm: z.coerce.date(),
  })
  .refine((dado) => MOTIVOS_POR_TIPO[dado.tipo].includes(dado.motivo), {
    message: "Motivo não é válido para o tipo informado",
    path: ["motivo"],
  });

const syncSchema = z.object({
  movimentacoes: z.array(movimentacaoSchema).min(1).max(200),
});

// Único caminho de escrita de movimentação — usado tanto para uma venda
// única feita online quanto para um lote acumulado offline. Sempre insere
// (nunca update/delete, ver docs/documento-de-visao.md seção 5.2) e é
// idempotente por "id": reenviar o mesmo lote (ex: retry de rede) não duplica.
movimentacoesRouter.post("/sync", async (req, res) => {
  const parse = syncSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const usuarioId = req.usuario!.usuarioId;

  const resultados = await prisma.$transaction(
    parse.data.movimentacoes.map((mov) =>
      prisma.movimentacao.upsert({
        where: { id: mov.id },
        create: { ...mov, usuarioId },
        update: {}, // já existe (reenvio) — não altera nada, só confirma sucesso
      })
    )
  );

  res.status(201).json({ sincronizadas: resultados.length });
});

// RF13: histórico/auditoria, somente leitura, só admin.
movimentacoesRouter.get("/", exigirPerfil("admin"), async (req, res) => {
  const produtoId = typeof req.query.produtoId === "string" ? req.query.produtoId : undefined;
  const pagina = Math.max(1, Number(req.query.pagina ?? 1));
  const porPagina = 50;

  const movimentacoes = await prisma.movimentacao.findMany({
    where: produtoId ? { produtoId } : undefined,
    include: { produto: true, usuario: { select: { id: true, nome: true } } },
    orderBy: { criadoEm: "desc" },
    skip: (pagina - 1) * porPagina,
    take: porPagina,
  });

  res.json(movimentacoes);
});
