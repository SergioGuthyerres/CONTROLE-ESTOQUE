import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../lib/env";

// O Express 4 NÃO captura exceções lançadas dentro de handlers async: a
// promise rejeita, ninguém chama next(erro) e a requisição fica pendurada até
// o cliente desistir. Todo handler async precisa passar por aqui.
type HandlerAsync = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function assincrono(handler: HandlerAsync) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Erros conhecidos do Prisma trazem um código "P####" — ver
// https://www.prisma.io/docs/reference/api-reference/error-reference
function erroDePrisma(erro: unknown): string | null {
  if (typeof erro !== "object" || erro === null) return null;
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" && /^P\d{4}$/.test(codigo) ? codigo : null;
}

export class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function tratadorDeErros(
  erro: unknown,
  _req: Request,
  res: Response,
  // O Express só reconhece um error handler se ele declarar 4 parâmetros.
  _next: NextFunction
) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message });
  }

  if (erro instanceof ZodError) {
    return res.status(400).json({ erro: erro.flatten() });
  }

  // Checagem pelo formato do erro em vez de `instanceof
  // Prisma.PrismaClientKnownRequestError`: o instanceof depende do cliente
  // gerado do Prisma, que muda de lugar entre versões e some quando o
  // `prisma generate` não rodou. O código P#### é estável.
  const codigoPrisma = erroDePrisma(erro);
  if (codigoPrisma) {
    // P2002: violação de campo único (ex: categoria com nome repetido, ou
    // dois usuários com o mesmo nome).
    if (codigoPrisma === "P2002") {
      return res.status(409).json({ erro: "Já existe um registro com esse nome" });
    }
    // P2025: update/delete em id que não existe.
    if (codigoPrisma === "P2025") {
      return res.status(404).json({ erro: "Registro não encontrado" });
    }
    // P2003: chave estrangeira inválida (ex: categoriaId inexistente).
    if (codigoPrisma === "P2003") {
      return res.status(400).json({ erro: "Referência inválida em um dos campos" });
    }
  }

  // Só chega aqui o que não foi previsto — loga inteiro no servidor, mas nunca
  // devolve stack trace ao cliente (vaza caminho de arquivo e versão de lib).
  console.error("Erro não tratado:", erro);
  return res.status(500).json({
    erro: env.emProducao ? "Erro interno do servidor" : String(erro),
  });
}

export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: "Rota não encontrada" });
}
