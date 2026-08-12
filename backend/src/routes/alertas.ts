import { Router } from "express";
import { exigirAutenticacao, exigirPerfil } from "../middleware/auth";
import { listarAlertas } from "../services/alertService";

export const alertasRouter = Router();
alertasRouter.use(exigirAutenticacao, exigirPerfil("admin"));

alertasRouter.get("/", async (_req, res) => {
  res.json(await listarAlertas());
});
