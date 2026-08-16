import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./lib/env";
import { tratadorDeErros, rotaNaoEncontrada } from "./middleware/erros";
import { limitadorGeral } from "./middleware/rateLimit";
import { authRouter } from "./routes/auth";
import { usuariosRouter } from "./routes/usuarios";
import { categoriasRouter } from "./routes/categorias";
import { produtosRouter } from "./routes/produtos";
import { movimentacoesRouter } from "./routes/movimentacoes";
import { alertasRouter } from "./routes/alertas";
import { relatoriosRouter } from "./routes/relatorios";
import { dashboardRouter } from "./routes/dashboard";
import { configRouter } from "./routes/config";

// Montado numa função para que os testes possam levantar o app numa porta
// efêmera sem depender do processo de produção — ver testes/seguranca.test.ts.
export function criarApp() {
  const app = express();

  // Em produção a API fica atrás do Caddy. Sem isto, req.ip é sempre o IP do
  // proxy e o rate limit vira decoração: todo mundo compartilha o mesmo balde.
  // O valor é 1 (só confia no primeiro proxy) e não "true", que aceitaria um
  // X-Forwarded-For forjado pelo cliente.
  if (env.trustProxy) app.set("trust proxy", 1);

  app.disable("x-powered-by");

  // A API só devolve JSON — nada aqui é renderizado num navegador, então o
  // conjunto restritivo do helmet não quebra nada. Os headers que importam para
  // o PWA em si ficam no host estático (ver frontend/public/_headers).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
        },
      },
      // "cross-origin" porque o PWA fica num domínio diferente do da API
      // (Cloudflare Pages x VPS). Com "same-site" o navegador pode recusar as
      // respostas — e o app abriria sem carregar dado nenhum.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: env.emProducao
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    }),
  );

  // Lista explícita de origens (FRONTEND_URL aceita valores separados por
  // vírgula). Requisição sem Origin — curl, healthcheck, o próprio celular em
  // alguns casos — passa; navegador de outro domínio, não.
  app.use(
    cors({
      origin(origem, callback) {
        const permitida =
          !origem || env.origensPermitidas.includes(origem.replace(/\/$/, ""));
        // Origem não permitida = simplesmente não mandar o cabeçalho
        // Access-Control-Allow-Origin; o navegador bloqueia sozinho. Lançar
        // erro aqui geraria um 500 com stack trace a cada requisição de origem
        // estranha — barulho no log e um jeito fácil de enchê-lo de propósito.
        callback(null, permitida);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
      maxAge: 86400,
    }),
  );

  // Teto de corpo explícito: o maior payload legítimo é um lote de sincronização
  // de 200 movimentações, bem abaixo disso.
  app.use(express.json({ limit: "200kb" }));

  if (env.nodeEnv !== "test") {
    app.use(
      morgan(env.emProducao ? "combined" : "dev", {
        // O healthcheck do systemd/Caddy bate de minuto em minuto e só polui o log.
        skip: (req) => req.url === "/health",
      }),
    );
  }

  app.use(limitadorGeral);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/usuarios", usuariosRouter);
  app.use("/categorias", categoriasRouter);
  app.use("/produtos", produtosRouter);
  app.use("/movimentacoes", movimentacoesRouter);
  app.use("/alertas", alertasRouter);
  app.use("/relatorios", relatoriosRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/config", configRouter);

  app.use(rotaNaoEncontrada);
  // Precisa ser o último: é ele que transforma qualquer exceção em resposta
  // JSON. Sem ele, um erro do Prisma deixaria a requisição pendurada.
  app.use(tratadorDeErros);

  return app;
}
