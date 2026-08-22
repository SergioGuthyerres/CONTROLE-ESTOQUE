import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao } from "../middleware/auth";
import { calcularEstoque, calcularEstoqueEmLote } from "../services/stockService";
import { TIPOS_MOVIMENTACAO, UNIDADES } from "../lib/enums";
import { assincrono } from "../middleware/erros";

export const produtosRouter = Router();
produtosRouter.use(exigirAutenticacao);

// RF06: busca textual única por nome/descrição — sem atalhos nem categorias
// como filtro obrigatório, decisão da seção 5.1 do documento de visão.
produtosRouter.get("/", assincrono(async (req, res) => {
  const busca = typeof req.query.busca === "string" ? req.query.busca : undefined;

  const produtos = await prisma.produto.findMany({
    where: busca ? { nome: { contains: busca } } : undefined,
    include: { categoria: true },
    orderBy: { nome: "asc" },
  });

  const estoquePorProduto = await calcularEstoqueEmLote(produtos.map((p) => p.id));

  res.json(
    produtos.map((produto) => ({
      ...produto,
      estoqueAtual: estoquePorProduto[produto.id] ?? 0,
    }))
  );
}));

// Atalhos da tela de venda/compra: os produtos que mais se movimentam neste
// tipo, para não obrigar a digitar o nome do que sai todo dia (RNF05).
//
// Fica aqui, no router de produtos, e não em /relatorios: relatórios são só
// de admin, e quem mais precisa do atalho é o funcionário.
//
// A janela é curta de propósito. O que a loja vende muda com a estação, e uma
// média de dois anos sugeriria ração de bezerro no meio da seca. 30 dias
// erram para o lado de esquecer rápido, que é o lado certo aqui.
const sugestoesSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMENTACAO),
  dias: z.coerce.number().int().positive().max(365).default(30),
  limite: z.coerce.number().int().positive().max(20).default(6),
});

produtosRouter.get("/mais-movimentados", assincrono(async (req, res) => {
  const parse = sugestoesSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const { tipo, dias, limite } = parse.data;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const agrupado = await prisma.movimentacao.groupBy({
    by: ["produtoId"],
    where: {
      tipo,
      criadoEm: { gte: desde },
      // Sugerir o produto que alguém digitou errado, e que por isso foi
      // estornado, é sugerir justamente o erro de novo.
      motivo: { not: "estorno" },
      estorno: { is: null },
    },
    // Conta lançamentos, não quantidade: o atalho existe para o produto que é
    // registrado MUITAS VEZES, não para o que sai em quilo. Um saco de 50 kg
    // vendido uma vez não deve empurrar para baixo o café vendido 30 vezes.
    _count: { _all: true },
    orderBy: { _count: { produtoId: "desc" } },
    take: limite,
  });

  res.json(agrupado.map((linha) => linha.produtoId));
}));

// RF07/5.2: usado pelo app antes de confirmar uma saída grande (>20 unidades)
// para conferir o estoque real no servidor, não o local do dispositivo.
produtosRouter.get("/:id/estoque", assincrono(async (req, res) => {
  const produto = await prisma.produto.findUnique({ where: { id: req.params.id } });
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado" });

  const estoqueAtual = await calcularEstoque(produto.id);
  res.json({ produtoId: produto.id, estoqueAtual });
}));

const produtoSchema = z.object({
  nome: z.string().min(1),
  categoriaId: z.string().min(1),
  unidade: z.enum(UNIDADES),
  estoqueMinimo: z.number().nonnegative().default(0),
});

produtosRouter.post("/", assincrono(async (req, res) => {
  const parse = produtoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const produto = await prisma.produto.create({ data: parse.data });
  res.status(201).json(produto);
}));

produtosRouter.put("/:id", assincrono(async (req, res) => {
  const parse = produtoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const produto = await prisma.produto.update({
    where: { id: req.params.id },
    data: parse.data,
  });
  res.json(produto);
}));
