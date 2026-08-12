import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import type { Perfil } from "../lib/enums";

export interface TokenPayload {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
}

export async function autenticar(nome: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { nome } });
  if (!usuario) return null;

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) return null;

  const payload: TokenPayload = {
    usuarioId: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil as Perfil,
  };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
  // 30 dias: funcionário não deve precisar logar de novo com frequência —
  // baixa maturidade digital torna reautenticação recorrente um ponto de atrito.

  return { token, usuario: payload };
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}
