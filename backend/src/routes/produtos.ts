import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao } from "../middleware/auth";
import { calcularEstoque, calcularEstoqueEmLote } from "../services/stockService";
import { UNIDADES } from "../lib/enums";

export const produtosRouter = Router();
produtosRouter.use(exigirAutenticacao);

// RF06: busca textual única por nome/descrição — sem atalhos nem categorias
// como filtro obrigatório, decisão da seção 5.1 do documento de visão.
produtosRouter.get("/", async (req, res) => {
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
});

// RF07/5.2: usado pelo app antes de confirmar uma saída grande (>20 unidades)
// para conferir o estoque real no servidor, não o local do dispositivo.
produtosRouter.get("/:id/estoque", async (req, res) => {
  const produto = await prisma.produto.findUnique({ where: { id: req.params.id } });
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado" });

  const estoqueAtual = await calcularEstoque(produto.id);
  res.json({ produtoId: produto.id, estoqueAtual });
});

const produtoSchema = z.object({
  nome: z.string().min(1),
  categoriaId: z.string().min(1),
  unidade: z.enum(UNIDADES),
  estoqueMinimo: z.number().nonnegative().default(0),
});

produtosRouter.post("/", async (req, res) => {
  const parse = produtoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const produto = await prisma.produto.create({ data: parse.data });
  res.status(201).json(produto);
});

produtosRouter.put("/:id", async (req, res) => {
  const parse = produtoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const produto = await prisma.produto.update({
    where: { id: req.params.id },
    data: parse.data,
  });
  res.json(produto);
});
