import { Router } from "express";
import { env } from "../lib/env";
import { exigirAutenticacao } from "../middleware/auth";

export const configRouter = Router();
configRouter.use(exigirAutenticacao);

// RF07: o front busca esse valor em vez de hardcodar "20", pra não ter dois
// lugares (front/back) que possam ficar dessincronizados.
configRouter.get("/", (_req, res) => {
  res.json({ limiteQuantidadeOnline: env.limiteQuantidadeOnline });
});
