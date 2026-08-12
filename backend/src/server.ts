import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { categoriasRouter } from "./routes/categorias";
import { produtosRouter } from "./routes/produtos";
import { movimentacoesRouter } from "./routes/movimentacoes";
import { alertasRouter } from "./routes/alertas";
import { relatoriosRouter } from "./routes/relatorios";
import { dashboardRouter } from "./routes/dashboard";
import { configRouter } from "./routes/config";

const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/categorias", categoriasRouter);
app.use("/produtos", produtosRouter);
app.use("/movimentacoes", movimentacoesRouter);
app.use("/alertas", alertasRouter);
app.use("/relatorios", relatoriosRouter);
app.use("/dashboard", dashboardRouter);
app.use("/config", configRouter);

app.listen(env.port, () => {
  console.log(`API rodando em http://localhost:${env.port}`);
});
