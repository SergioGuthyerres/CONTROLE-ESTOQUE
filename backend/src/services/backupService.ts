// RF16/RNF04: backup sem custo — o banco é um arquivo único (SQLite).
//
// Por que não é um `cp` do arquivo:
// copiar o .db enquanto a API está escrevendo produz um backup que pode estar
// no meio de uma transação — e o pedaço que falta está no arquivo -wal, que o
// `cp` não leva junto. O backup parece existir e só se revela quebrado no dia
// em que for preciso restaurar. `VACUUM INTO` pede o lock ao próprio SQLite e
// grava um arquivo consistente, com a API no ar.
//
// Isto é um módulo, e não só um script, porque outros comandos precisam fazer
// backup antes de mexer no banco — ver src/scripts/limparDados.ts.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const RETENCAO_PADRAO = 30;

export function caminhoDoBanco(): string {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const caminhoDb = databaseUrl.replace(/^file:/, "");
  // Prisma resolve "file:" relativo à pasta prisma/ (onde fica schema.prisma),
  // não à raiz do backend. Caminho absoluto (recomendado em produção) passa
  // direto por path.resolve sem alteração.
  return path.resolve(__dirname, "../../prisma", caminhoDb);
}

export function pastaDeBackups(): string {
  return process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(__dirname, "../../backups");
}

export interface ResultadoBackup {
  destino: string;
  tamanhoMb: string;
  removidos: string[];
  retencao: number;
}

export async function criarBackup(): Promise<ResultadoBackup> {
  const caminhoAbsolutoDb = caminhoDoBanco();
  const pastaBackups = pastaDeBackups();
  const retencao = Number(process.env.BACKUP_RETENCAO ?? RETENCAO_PADRAO);

  if (!fs.existsSync(caminhoAbsolutoDb)) {
    throw new Error(
      `Banco não encontrado em ${caminhoAbsolutoDb} (DATABASE_URL="${process.env.DATABASE_URL}")`
    );
  }

  fs.mkdirSync(pastaBackups, { recursive: true });
  // 0700: o backup contém os hashes de senha e todo o histórico da loja. Sem
  // isto ele nasce legível para qualquer usuário do servidor.
  fs.chmodSync(pastaBackups, 0o700);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = path.join(pastaBackups, `estoque-${timestamp}.db`);

  // VACUUM INTO recusa sobrescrever arquivo existente — o timestamp já garante
  // nome único, mas isso também impede um backup corromper o outro.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

  fs.chmodSync(destino, 0o600);

  // Rotação: sem isto a partição da VPS free tier enche em alguns meses e a
  // API para de conseguir escrever — o backup derruba o sistema que devia proteger.
  const removidos = fs
    .readdirSync(pastaBackups)
    .filter((arquivo) => /^estoque-.*\.db$/.test(arquivo))
    .sort()
    .reverse()
    .slice(retencao);

  for (const arquivo of removidos) {
    fs.unlinkSync(path.join(pastaBackups, arquivo));
  }

  return {
    destino,
    tamanhoMb: (fs.statSync(destino).size / 1024 / 1024).toFixed(2),
    removidos,
    retencao,
  };
}
