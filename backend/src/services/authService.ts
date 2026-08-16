import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { conferirSenha, gerarHashSenha } from "../lib/senha";
import type { Perfil } from "../lib/enums";

export interface TokenPayload {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  // Cópia do Usuario.tokenVersion no momento da emissão. O middleware compara
  // com o valor atual do banco; se alguém incrementou, este token morreu.
  tv: number;
}

export interface UsuarioSessao extends TokenPayload {
  precisaTrocarSenha: boolean;
}

// 30 dias: funcionário não deve precisar logar de novo com frequência —
// baixa maturidade digital torna reautenticação recorrente um ponto de atrito
// (RNF05). O preço é que um aparelho perdido segue autenticado; a revogação
// fica por conta de Usuario.tokenVersion e Usuario.ativo, checados a cada
// requisição em src/middleware/auth.ts.
const VALIDADE_TOKEN = "30d";

// Hash descartável (bcrypt de uma senha aleatória) usado só para gastar tempo.
const HASH_FALSO = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.5A/kg0dEFqUZQr6QCiLPuLQPPqvlNHi";

export async function autenticar(nome: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { nome } });

  // Mesmo quando o usuário não existe, gastamos o tempo de um bcrypt. Sem
  // isso, "usuário inexistente" responde em 1ms e "senha errada" em 250ms — a
  // diferença revela quais logins existem no sistema.
  if (!usuario) {
    await conferirSenha(senha, HASH_FALSO);
    return null;
  }

  const senhaValida = await conferirSenha(senha, usuario.senhaHash);
  if (!senhaValida) return null;

  // Usuário desativado não recebe token — e a resposta ao cliente é a mesma de
  // senha errada, para não confirmar que a conta existe.
  if (!usuario.ativo) return null;

  const payload: TokenPayload = {
    usuarioId: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil as Perfil,
    tv: usuario.tokenVersion,
  };

  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: VALIDADE_TOKEN });

  const sessao: UsuarioSessao = { ...payload, precisaTrocarSenha: usuario.precisaTrocarSenha };
  return { token, usuario: sessao };
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

// Troca de senha feita pelo próprio dono da conta: exige a senha atual (senão
// um token roubado bastaria para tomar a conta em definitivo) e incrementa
// tokenVersion, o que derruba a sessão em todos os outros aparelhos.
// O aparelho que fez a troca recebe um token novo na resposta: ele não deve
// ser punido por trocar a senha. Todos os outros aparelhos caem.
export type ResultadoTrocaSenha =
  | { status: "ok"; token: string; usuario: UsuarioSessao }
  | { status: "senha-atual-incorreta" }
  | { status: "senha-igual" };

export async function trocarPropriaSenha(
  usuarioId: string,
  senhaAtual: string,
  senhaNova: string
): Promise<ResultadoTrocaSenha> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return { status: "senha-atual-incorreta" };

  if (!(await conferirSenha(senhaAtual, usuario.senhaHash))) {
    return { status: "senha-atual-incorreta" };
  }
  if (await conferirSenha(senhaNova, usuario.senhaHash)) {
    return { status: "senha-igual" };
  }

  const atualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      senhaHash: await gerarHashSenha(senhaNova),
      precisaTrocarSenha: false,
      tokenVersion: { increment: 1 },
    },
  });

  const payload: TokenPayload = {
    usuarioId: atualizado.id,
    nome: atualizado.nome,
    perfil: atualizado.perfil as Perfil,
    tv: atualizado.tokenVersion,
  };

  return {
    status: "ok",
    token: jwt.sign(payload, env.jwtSecret, { expiresIn: VALIDADE_TOKEN }),
    usuario: { ...payload, precisaTrocarSenha: false },
  };
}
