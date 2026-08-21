import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { calcularValorTotalEstoque } from "../services/stockService";
import { assincrono } from "../middleware/erros";
import { resumirPeriodo } from "../services/resumoService";

export const relatoriosRouter = Router();
relatoriosRouter.use(exigirAutenticacao, exigirPerfil("admin"));

// Período opcional dos dois lados: "desde 01/08" e "até 15/08" são recortes
// tão legítimos quanto o intervalo fechado, e sem nenhum dos dois o relatório
// é o histórico inteiro.
//
// Validado com zod em vez do `new Date(...)` que estava aqui: uma data
// impossível virava `Invalid Date`, ia parar no Prisma e voltava como erro
// 500 sem explicação. Agora volta 400 dizendo qual campo está errado.
const periodoOpcionalSchema = z
  .object({
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
  })
  .refine(
    (periodo) =>
      !periodo.dataInicio || !periodo.dataFim || periodo.dataInicio <= periodo.dataFim,
    { message: "A data inicial precisa ser anterior à data final", path: ["dataFim"] },
  );

// RF11: produtos mais/menos movimentados num período (soma de entrada+saida).
relatoriosRouter.get("/movimentacao-por-produto", assincrono(async (req, res) => {
  const parse = periodoOpcionalSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const { dataInicio, dataFim } = parse.data;

  const agrupado = await prisma.movimentacao.groupBy({
    by: ["produtoId"],
    where: {
      criadoEm: {
        gte: dataInicio,
        lte: dataFim,
      },
      // Uma movimentação desfeita e o estorno dela se anulam no estoque, mas
      // somariam DOBRADO num relatório de "mais movimentados" — o produto
      // digitado errado apareceria no topo justamente por ter sido corrigido.
      // Fora as duas, sobra o que de fato girou.
      motivo: { not: "estorno" },
      estorno: { is: null },
    },
    _sum: { quantidade: true },
  });

  const produtos = await prisma.produto.findMany({
    where: { id: { in: agrupado.map((linha) => linha.produtoId) } },
  });
  const nomePorId = new Map(produtos.map((p) => [p.id, p.nome]));

  const resultado = agrupado
    .map((linha) => ({
      produtoId: linha.produtoId,
      produtoNome: nomePorId.get(linha.produtoId) ?? "(produto removido)",
      totalMovimentado: Number(linha._sum.quantidade ?? 0),
    }))
    .sort((a, b) => b.totalMovimentado - a.totalMovimentado);

  res.json(resultado);
}));

// Conferência de caixa: o que foi vendido, o que foi comprado e o que mais
// mexeu no estoque num período — normalmente um dia.
//
// As datas são obrigatórias aqui, ao contrário do histórico: um "resumo do
// dia" sem dia é a soma do sistema inteiro, um número enorme que ninguém
// pediu e que faz o servidor varrer a tabela toda para produzir.
const periodoSchema = z
  .object({
    dataInicio: z.coerce.date(),
    dataFim: z.coerce.date(),
  })
  .refine((periodo) => periodo.dataInicio <= periodo.dataFim, {
    message: "A data inicial precisa ser anterior à data final",
    path: ["dataFim"],
  });

relatoriosRouter.get("/resumo-do-dia", assincrono(async (req, res) => {
  const parse = periodoSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  res.json(await resumirPeriodo(parse.data.dataInicio, parse.data.dataFim));
}));

// RF12: valor total em estoque, por produto e consolidado.
relatoriosRouter.get("/valor-total-estoque", assincrono(async (_req, res) => {
  const resultado = await calcularValorTotalEstoque();
  res.json(resultado);
}));
