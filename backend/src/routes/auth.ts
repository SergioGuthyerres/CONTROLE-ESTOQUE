import { Router } from "express";
import { z } from "zod";
import { autenticar, trocarPropriaSenha } from "../services/authService";
import { esquemaSenha } from "../lib/senha";
import { exigirAutenticacao } from "../middleware/auth";
import { assincrono } from "../middleware/erros";
import { limitadorLogin } from "../middleware/rateLimit";
import { prisma } from "../lib/prisma";

export const authRouter = Router();

const loginSchema = z.object({
  nome: z.string().min(1).max(60),
  senha: z.string().min(1).max(128),
});

authRouter.post(
  "/login",
  limitadorLogin,
  assincrono(async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ erro: "Nome e senha são obrigatórios" });
    }

    const resultado = await autenticar(parse.data.nome.trim(), parse.data.senha);
    // Mesma mensagem para usuário inexistente, senha errada e conta desativada:
    // qualquer diferença aqui vira uma forma de descobrir quem tem conta.
    if (!resultado) {
      return res.status(401).json({ erro: "Nome ou senha incorretos" });
    }

    res.json(resultado);
  })
);

// O front chama isto ao abrir o app para saber se a sessão guardada ainda vale
// (o token pode ter sido revogado enquanto o celular estava offline).
authRouter.get(
  "/eu",
  exigirAutenticacao,
  assincrono(async (req, res) => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.usuario!.usuarioId },
      select: { id: true, nome: true, perfil: true, precisaTrocarSenha: true },
    });
    res.json({
      usuarioId: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil,
      precisaTrocarSenha: usuario.precisaTrocarSenha,
    });
  })
);

const trocaSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  senhaNova: esquemaSenha,
});

authRouter.post(
  "/trocar-senha",
  exigirAutenticacao,
  assincrono(async (req, res) => {
    const parse = trocaSenhaSchema.safeParse(req.body);
    if (!parse.success) {
      const problemas = parse.error.flatten().fieldErrors;
      return res.status(400).json({
        erro: problemas.senhaNova?.[0] ?? problemas.senhaAtual?.[0] ?? "Dados inválidos",
      });
    }

    const resultado = await trocarPropriaSenha(
      req.usuario!.usuarioId,
      parse.data.senhaAtual,
      parse.data.senhaNova
    );

    if (resultado.status === "senha-atual-incorreta") {
      return res.status(400).json({ erro: "Senha atual incorreta" });
    }
    if (resultado.status === "senha-igual") {
      return res.status(400).json({ erro: "A senha nova precisa ser diferente da atual" });
    }

    // Token novo porque a troca invalidou o anterior (tokenVersion mudou). Sem
    // devolver este, o próprio usuário seria deslogado ao trocar a senha.
    res.json({ token: resultado.token, usuario: resultado.usuario });
  })
);
