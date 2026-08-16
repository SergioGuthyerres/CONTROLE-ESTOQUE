import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../lib/env";

// Sem isto, a senha de qualquer usuário cai por força bruta: o /auth/login não
// tinha limite nenhum e um script consegue milhares de tentativas por minuto.
//
// A chave é o IP, não o nome do usuário. Limitar por nome de usuário parece
// mais preciso, mas permite que qualquer pessoa tranque o login do dono da
// loja de propósito, só errando a senha dele várias vezes.
export const limitadorLogin = rateLimit({
  windowMs: env.loginJanelaMs,
  limit: env.loginMaxTentativas,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Login que deu certo não conta para o limite — quem sabe a senha nunca é
  // bloqueado, mesmo que a loja inteira use o mesmo wi-fi.
  skipSuccessfulRequests: true,
  message: {
    erro: "Muitas tentativas de login. Aguarde alguns minutos e tente de novo.",
  },
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "desconhecido"),
});

// Teto geral, folgado de propósito: a sincronização offline manda lotes em
// rajada quando o celular reencontra a internet (RNF02/RNF06) e não pode ser
// barrada. Isto existe só para conter varredura automatizada.
export const limitadorGeral = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um instante." },
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "desconhecido"),
});

// Criar e resetar senha de usuário é operação rara e sensível — limite baixo
// reduz o estrago caso um token de admin vaze.
export const limitadorAdministrativo = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Muitas operações administrativas nesta hora. Tente mais tarde." },
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "desconhecido"),
});
