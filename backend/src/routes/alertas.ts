import { Router } from "express";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { listarAlertas } from "../services/alertService";
import { assincrono } from "../middleware/erros";

export const alertasRouter = Router();
alertasRouter.use(exigirAutenticacao, exigirPerfil("admin"));

alertasRouter.get("/", assincrono(async (_req, res) => {
  res.json(await listarAlertas());
}));
