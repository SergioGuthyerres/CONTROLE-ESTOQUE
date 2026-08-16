import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao } from "../middleware/auth";
import { assincrono } from "../middleware/erros";

export const categoriasRouter = Router();
categoriasRouter.use(exigirAutenticacao);

categoriasRouter.get("/", assincrono(async (_req, res) => {
  const categorias = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
  res.json(categorias);
}));

const categoriaSchema = z.object({ nome: z.string().min(1) });

categoriasRouter.post("/", assincrono(async (req, res) => {
  const parse = categoriaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Nome é obrigatório" });

  const categoria = await prisma.categoria.create({ data: parse.data });
  res.status(201).json(categoria);
}));

categoriasRouter.put("/:id", assincrono(async (req, res) => {
  const parse = categoriaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: "Nome é obrigatório" });

  const categoria = await prisma.categoria.update({
    where: { id: req.params.id },
    data: parse.data,
  });
  res.json(categoria);
}));
