import { criarApp } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";

const app = criarApp();

const servidor = app.listen(env.port, env.host, () => {
  console.log(`API (${env.nodeEnv}) ouvindo em ${env.host}:${env.port}`);
});

// O systemd manda SIGTERM em cada "restart"/"stop". Sem fechar a conexão do
// Prisma, o SQLite pode ficar com o journal aberto e o próximo start reclamar.
for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, () => {
    console.log(`${sinal} recebido, encerrando...`);
    servidor.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Se alguma conexão travar, não deixa o processo pendurado para sempre.
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
