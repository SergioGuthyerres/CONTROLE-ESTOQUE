import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { MOTIVOS_POR_TIPO, TIPOS_MOVIMENTACAO, MOTIVOS_MOVIMENTACAO } from "../lib/enums";
import { assincrono } from "../middleware/erros";
import { dadosDoEstorno } from "../services/estornoService";

export const movimentacoesRouter = Router();
movimentacoesRouter.use(exigirAutenticacao);

// A data vem do relógio do celular, não do servidor — é o preço de aceitar
// lançamento offline (RNF02). Mas sem limite nenhum um cliente adulterado
// consegue plantar movimentação com data de 2019 ou de 2030 e sujar todo o
// histórico e os relatórios por período (RF11/RF13). A folga cobre relógio
// desregulado e celular que ficou dias sem internet; fora disso, recusa.
const TOLERANCIA_FUTURO_MS = 24 * 60 * 60 * 1000; // 1 dia
const TOLERANCIA_PASSADO_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

const movimentacaoSchema = z
  .object({
    id: z.string().uuid(), // gerado no cliente — permite sincronização idempotente
    produtoId: z.string().min(1).max(60),
    tipo: z.enum(TIPOS_MOVIMENTACAO),
    motivo: z.enum(MOTIVOS_MOVIMENTACAO),
    // Teto de sanidade: o maior lançamento plausível da loja está muito abaixo
    // disso, e sem teto um erro de digitação (ou um cliente adulterado) faz o
    // estoque e o valor total do RF12 explodirem.
    quantidade: z.number().positive().finite().max(1_000_000),
    valor: z.number().nonnegative().finite().max(10_000_000).default(0),
    origemDispositivo: z.string().min(1).max(100),
    criadoEm: z.coerce
      .date()
      .refine(
        (data) => data.getTime() <= Date.now() + TOLERANCIA_FUTURO_MS,
        "Data da movimentação está no futuro — verifique a data e a hora do aparelho"
      )
      .refine(
        (data) => data.getTime() >= Date.now() - TOLERANCIA_PASSADO_MS,
        "Data da movimentação é antiga demais (mais de 90 dias) para ser sincronizada"
      ),
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
movimentacoesRouter.post("/sync", assincrono(async (req, res) => {
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
}));

// RF13: histórico/auditoria, somente leitura, só admin.
//
// "estorno" e "estornoDe" vêm junto porque a tela precisa saber, de cada
// linha, se ela já foi desfeita (então não oferece o botão) e se ela é o
// desfazer de outra (então mostra de qual).
const RESUMO_LIGADO = { select: { id: true, criadoEm: true } };

movimentacoesRouter.get("/", exigirPerfil("admin"), assincrono(async (req, res) => {
  const produtoId = typeof req.query.produtoId === "string" ? req.query.produtoId : undefined;
  const pagina = Math.max(1, Number(req.query.pagina ?? 1));
  const porPagina = 50;

  const movimentacoes = await prisma.movimentacao.findMany({
    where: produtoId ? { produtoId } : undefined,
    include: {
      produto: true,
      usuario: { select: { id: true, nome: true } },
      estorno: RESUMO_LIGADO,
      estornoDe: RESUMO_LIGADO,
    },
    orderBy: { criadoEm: "desc" },
    skip: (pagina - 1) * porPagina,
    take: porPagina,
  });

  res.json(movimentacoes);
}));

// Desfazer uma movimentação lançada por engano (venda digitada duas vezes,
// quantidade errada, produto trocado). Não apaga nada: cria a movimentação
// inversa — ver src/services/estornoService.ts para o porquê.
//
// Só admin. O funcionário que erra avisa a dona; quem desfaz é quem responde
// pelo estoque, e o histórico registra quem foi.
movimentacoesRouter.post(
  "/:id/estorno",
  exigirPerfil("admin"),
  assincrono(async (req, res) => {
    const original = await prisma.movimentacao.findUnique({
      where: { id: req.params.id },
      include: { estorno: { select: { id: true } } },
    });

    if (!original) return res.status(404).json({ erro: "Movimentação não encontrada" });

    const dados = dadosDoEstorno(original, req.usuario!.usuarioId);

    // O índice único em estornoDeId é a última linha de defesa: dois cliques
    // simultâneos passam os dois pela checagem acima, e é o banco que recusa
    // o segundo (P2002 → 409 no tratador global de erros).
    const estorno = await prisma.movimentacao.create({
      data: { ...dados, id: randomUUID() },
      include: {
        produto: true,
        usuario: { select: { id: true, nome: true } },
        estornoDe: RESUMO_LIGADO,
      },
    });

    res.status(201).json(estorno);
  }),
);
