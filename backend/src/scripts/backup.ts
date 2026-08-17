// Backup do banco (RF16/RNF04). Rodar com: npm run backup
// Em produção, onde as dependências de desenvolvimento não são instaladas:
//   node dist/scripts/backup.js
// Para automatizar, agende no cron da VPS (ver deploy/backup.cron).
//
// A lógica em si está em src/services/backupService.ts — este arquivo é só a
// interface de linha de comando.
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { criarBackup } from "../services/backupService";

criarBackup()
  .then((resultado) => {
    console.log(`Backup criado: ${resultado.destino} (${resultado.tamanhoMb} MB)`);

    for (const arquivo of resultado.removidos) {
      console.log(`Backup antigo removido: ${arquivo}`);
    }
    if (resultado.removidos.length === 0) {
      console.log(`Retenção: mantendo os ${resultado.retencao} backups mais recentes.`);
    }

    console.log(
      "\nLembrete: um backup que só existe na mesma máquina do banco não protege\n" +
        "contra a VPS sumir. Ver a seção de backup externo em deploy/README-DEPLOY.md."
    );
  })
  .catch((erro) => {
    console.error("Falha no backup:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
