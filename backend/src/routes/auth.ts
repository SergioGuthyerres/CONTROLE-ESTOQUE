import { Router } from "express";
import { z } from "zod";
import { autenticar } from "../services/authService";

export const authRouter = Router();

const loginSchema = z.object({
  nome: z.string().min(1),
  senha: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Nome e senha são obrigatórios" });
  }

  const resultado = await autenticar(parse.data.nome, parse.data.senha);
  if (!resultado) {
    return res.status(401).json({ erro: "Nome ou senha incorretos" });
  }

  res.json(resultado);
});
