import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import {
  TIPOS_MOVIMENTACAO,
  MOTIVOS_MOVIMENTACAO,
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_PADRAO,
  ehVenda,
} from "../lib/enums";
import { assincrono } from "../middleware/erros";
import { dadosDoEstorno } from "../services/estornoService";
import { syncSchema } from "../lib/movimentacaoSchema";

export const movimentacoesRouter = Router();
movimentacoesRouter.use(exigirAutenticacao);

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
        create: {
          ...mov,
          usuarioId,
          // Venda que chega sem forma de pagamento vem de um PWA anterior a
          // esta versão, quando toda venda era à vista. Preencher aqui, na
          // entrada, evita que todo relatório precise tratar nulo depois.
          formaPagamento: ehVenda(mov.tipo, mov.motivo)
            ? (mov.formaPagamento ?? FORMA_PAGAMENTO_PADRAO)
            : null,
        },
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

// Filtros aceitos na listagem. Validados em vez de repassados crus: um
// `tipo=qualquer-coisa` que chegasse ao Prisma devolveria lista vazia sem
// explicação, e quem está no histórico procurando uma venda concluiria que a
// venda sumiu.
//
// "motivo" aceita a lista inteira, "estorno" incluído: aqui é leitura, e ver
// só os estornos é justamente o filtro que interessa a quem confere o que foi
// desfeito no mês.
//
// dataInicio/dataFim são instantes ISO completos, não datas soltas: quem
// converte "o dia 21" nos instantes que delimitam esse dia é o navegador, que
// é o único dos dois lados que conhece o fuso da loja (ver
// frontend/src/lib/datas.ts). Aqui só se compara instante com instante.
const filtrosSchema = z
  .object({
    produtoId: z.string().min(1).max(60).optional(),
    tipo: z.enum(TIPOS_MOVIMENTACAO).optional(),
    motivo: z.enum(MOTIVOS_MOVIMENTACAO).optional(),
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    pagina: z.coerce.number().int().positive().default(1),
  })
  .refine(
    (filtros) =>
      !filtros.dataInicio || !filtros.dataFim || filtros.dataInicio <= filtros.dataFim,
    {
      message: "A data inicial precisa ser anterior à data final",
      path: ["dataFim"],
    },
  );

const POR_PAGINA = 50;

movimentacoesRouter.get("/", exigirPerfil("admin"), assincrono(async (req, res) => {
  const parse = filtrosSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const { produtoId, tipo, motivo, formaPagamento, dataInicio, dataFim, pagina } = parse.data;
  const porPagina = POR_PAGINA;

  const filtro = {
    produtoId,
    tipo,
    motivo,
    formaPagamento,
    // Sem nenhuma das duas datas, o objeto fica `{}` e o Prisma o ignora —
    // por isso o intervalo é opcional dos dois lados: "a partir de tal dia"
    // e "até tal dia" são buscas tão legítimas quanto o intervalo fechado.
    criadoEm: { gte: dataInicio, lte: dataFim },
  };

  const movimentacoes = await prisma.movimentacao.findMany({
    where: filtro,
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
      include: {
        estorno: { select: { id: true } },
        pagamentoFiado: { select: { id: true } },
      },
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
