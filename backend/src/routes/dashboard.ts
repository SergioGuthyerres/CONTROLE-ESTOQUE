import { Router } from "express";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { calcularValorTotalEstoque } from "../services/stockService";
import { listarAlertas } from "../services/alertService";
import { assincrono } from "../middleware/erros";

export const dashboardRouter = Router();
dashboardRouter.use(exigirAutenticacao, exigirPerfil("admin"));

// RF08: indicadores + alertas para a tela inicial do admin.
dashboardRouter.get("/", assincrono(async (_req, res) => {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const [totalProdutos, movimentacoesUltimos30Dias, { valorTotal }, alertas] = await Promise.all([
    prisma.produto.count(),
    prisma.movimentacao.count({ where: { criadoEm: { gte: trintaDiasAtras } } }),
    calcularValorTotalEstoque(),
    listarAlertas(),
  ]);

  res.json({
    totalProdutos,
    valorTotalEstoque: valorTotal,
    movimentacoesUltimos30Dias,
    alertas,
  });
}));
