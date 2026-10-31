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

  const [totalProdutos, movimentacoesUltimos30Dias, estoque, alertas] = await Promise.all([
    // Só os em uso: arquivado sumiu das telas e contá-lo aqui faria o número
    // do painel brigar com o que a tela de produtos mostra.
    prisma.produto.count({ where: { arquivadoEm: null } }),
    prisma.movimentacao.count({ where: { criadoEm: { gte: trintaDiasAtras } } }),
    calcularValorTotalEstoque(),
    listarAlertas(),
  ]);

  res.json({
    totalProdutos,
    valorTotalEstoque: estoque.valorTotal,
    movimentacoesUltimos30Dias,
    alertas,
    // A lista inteira vem junto: a pergunta "quanto eu tenho de cada coisa e
    // quanto isso vale" é a que o painel existe para responder, e ela estava
    // sendo calculada e jogada fora.
    produtos: estoque.linhas,
  });
}));
