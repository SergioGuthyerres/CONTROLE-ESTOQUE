// RF16/RNF04: backup automático sem custo — o banco é um arquivo único
// (SQLite), então "backup" aqui é só copiar esse arquivo com timestamp.
// Rodar com: npm run backup
// Para automatizar, agende esse comando num cron da própria VPS (ver
// backend/README.md) — nenhuma ferramenta paga envolvida.
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const caminhoDb = databaseUrl.replace(/^file:/, "");
// Prisma resolve "file:" do datasource relativo à pasta prisma/ (onde fica
// schema.prisma), não à raiz do backend — mesma referência aqui, senão o
// backup copia um caminho que nunca existiu.
const caminhoAbsolutoDb = path.resolve(__dirname, "../../prisma", caminhoDb);

const pastaBackups = path.resolve(__dirname, "../../backups");
fs.mkdirSync(pastaBackups, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destino = path.join(pastaBackups, `dev-${timestamp}.db`);

fs.copyFileSync(caminhoAbsolutoDb, destino);
console.log(`Backup criado em ${destino}`);
