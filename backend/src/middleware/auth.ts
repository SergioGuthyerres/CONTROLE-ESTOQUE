import type { NextFunction, Request, Response } from "express";
import { verificarToken, type TokenPayload } from "../services/authService";
import type { Perfil } from "../lib/enums";

// Anexa o usuário autenticado à requisição — ver tipos em src/types/express.d.ts
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

export function exigirAutenticacao(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Token ausente" });
  }

  try {
    req.usuario = verificarToken(token);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

// Uso: router.get("/rota", exigirAutenticacao, exigirPerfil("admin"), handler)
export function exigirPerfil(...perfis: Perfil[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: "Sem permissão para esta ação" });
    }
    next();
  };
}
