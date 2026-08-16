// RF16/RNF04: backup sem custo — o banco é um arquivo único (SQLite).
// Rodar com: npm run backup
// Para automatizar, agende no cron da própria VPS (ver deploy/README-DEPLOY.md).
//
// Por que não é um `cp` do arquivo:
// copiar o .db enquanto a API está escrevendo produz um backup que pode estar
// no meio de uma transação — e o pedaço que falta está no arquivo -wal, que o
// `cp` não leva junto. O backup parece existir e só se revela quebrado no dia
// em que for preciso restaurar. `VACUUM INTO` pede o lock ao próprio SQLite e
// grava um arquivo consistente, com a API no ar.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const RETENCAO_PADRAO = 30;

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const caminhoDb = databaseUrl.replace(/^file:/, "");
// Prisma resolve "file:" relativo à pasta prisma/ (onde fica schema.prisma),
// não à raiz do backend. Caminho absoluto (recomendado em produção) passa
// direto por path.resolve sem alteração.
const caminhoAbsolutoDb = path.resolve(__dirname, "../../prisma", caminhoDb);

const pastaBackups = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(__dirname, "../../backups");

const retencao = Number(process.env.BACKUP_RETENCAO ?? RETENCAO_PADRAO);

async function main() {
  if (!fs.existsSync(caminhoAbsolutoDb)) {
    throw new Error(
      `Banco não encontrado em ${caminhoAbsolutoDb} (DATABASE_URL="${databaseUrl}")`
    );
  }

  fs.mkdirSync(pastaBackups, { recursive: true });
  // 0700: o backup contém os hashes de senha e todo o histórico da loja. Sem
  // isto ele nasce legível para qualquer usuário do servidor.
  fs.chmodSync(pastaBackups, 0o700);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = path.join(pastaBackups, `estoque-${timestamp}.db`);

  const prisma = new PrismaClient();
  try {
    // VACUUM INTO recusa sobrescrever arquivo existente — o timestamp já
    // garante nome único, mas isso também impede um backup corromper o outro.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  } finally {
    await prisma.$disconnect();
  }

  fs.chmodSync(destino, 0o600);

  const tamanhoMb = (fs.statSync(destino).size / 1024 / 1024).toFixed(2);
  console.log(`Backup criado: ${destino} (${tamanhoMb} MB)`);

  // Rotação: sem isto a partição da VPS free tier enche em alguns meses e a
  // API para de conseguir escrever — o backup derruba o sistema que devia proteger.
  const antigos = fs
    .readdirSync(pastaBackups)
    .filter((arquivo) => /^estoque-.*\.db$/.test(arquivo))
    .sort()
    .reverse()
    .slice(retencao);

  for (const arquivo of antigos) {
    fs.unlinkSync(path.join(pastaBackups, arquivo));
    console.log(`Backup antigo removido: ${arquivo}`);
  }

  if (antigos.length === 0) {
    console.log(`Retenção: mantendo os ${retencao} backups mais recentes.`);
  }

  console.log(
    "\nLembrete: um backup que só existe na mesma máquina do banco não protege\n" +
      "contra a VPS sumir. Ver a seção de backup externo em deploy/README-DEPLOY.md."
  );
}

main().catch((erro) => {
  console.error("Falha no backup:", erro);
  process.exit(1);
});
