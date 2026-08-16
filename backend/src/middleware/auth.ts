import type { NextFunction, Request, Response } from "express";
import { verificarToken, type TokenPayload } from "../services/authService";
import { prisma } from "../lib/prisma";
import { assincrono } from "./erros";
import type { Perfil } from "../lib/enums";

// Anexa o usuário autenticado à requisição.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

// Únicas rotas que funcionam para quem está com senha provisória. Todo o resto
// responde 403 até a senha ser trocada — é o que impede que a senha inicial
// digitada pelo admin vire a senha permanente do funcionário.
const ROTAS_LIBERADAS_COM_SENHA_PROVISORIA = ["/auth/trocar-senha", "/auth/eu"];

export const exigirAutenticacao = assincrono(
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ erro: "Token ausente" });
    }

    let payload: TokenPayload;
    try {
      payload = verificarToken(token);
    } catch {
      return res.status(401).json({ erro: "Token inválido ou expirado" });
    }

    // Assinatura válida não basta. O token dura 30 dias, então confirmamos no
    // banco, a cada requisição, que a conta ainda existe, segue ativa e que a
    // sessão não foi revogada. São poucos usuários num SQLite local — o custo
    // dessa consulta é irrelevante nesta escala.
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.usuarioId },
      select: {
        id: true,
        nome: true,
        perfil: true,
        ativo: true,
        tokenVersion: true,
        precisaTrocarSenha: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: "Sessão encerrada. Entre novamente." });
    }
    if (usuario.tokenVersion !== payload.tv) {
      return res.status(401).json({ erro: "Sessão encerrada em outro aparelho. Entre novamente." });
    }

    // O perfil vem do banco, não do token: se o admin rebaixou alguém, a
    // mudança vale na hora, sem esperar os 30 dias do token vencerem.
    req.usuario = {
      usuarioId: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil as Perfil,
      tv: usuario.tokenVersion,
    };

    const rotaAtual = `${req.baseUrl}${req.path}`.replace(/\/$/, "");
    if (usuario.precisaTrocarSenha && !ROTAS_LIBERADAS_COM_SENHA_PROVISORIA.includes(rotaAtual)) {
      return res.status(403).json({
        erro: "Troque a senha provisória antes de usar o sistema",
        codigo: "SENHA_PROVISORIA",
      });
    }

    next();
  }
);

// Uso: router.get("/rota", exigirAutenticacao, exigirPerfil("admin"), handler)
export function exigirPerfil(...perfis: Perfil[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: "Sem permissão para esta ação" });
    }
    next();
  };
}
