import { Router } from "express";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { calcularValorTotalEstoque } from "../services/stockService";
import { assincrono } from "../middleware/erros";

export const relatoriosRouter = Router();
relatoriosRouter.use(exigirAutenticacao, exigirPerfil("admin"));

// RF11: produtos mais/menos movimentados num período (soma de entrada+saida).
relatoriosRouter.get("/movimentacao-por-produto", assincrono(async (req, res) => {
  const dataInicio = typeof req.query.dataInicio === "string" ? new Date(req.query.dataInicio) : undefined;
  const dataFim = typeof req.query.dataFim === "string" ? new Date(req.query.dataFim) : undefined;

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

// RF12: valor total em estoque, por produto e consolidado.
relatoriosRouter.get("/valor-total-estoque", assincrono(async (_req, res) => {
  const resultado = await calcularValorTotalEstoque();
  res.json(resultado);
}));
