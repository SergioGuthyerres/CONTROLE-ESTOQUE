// Zera os dados operacionais do sistema, preservando os usuários.
//
//   npm run limpar-dados -- --confirmar
//
// Para que serve: depois de testar a aplicação, deixar o banco limpo antes de
// entregar ao cliente — sem precisar refazer o criar-admin nem redistribuir as
// senhas dos funcionários.
//
// O que apaga: movimentações, produtos e categorias.
// O que preserva: usuários, com senhas, perfis e sessões intactos.
//
// Não existe "desfazer". Por isso o script faz um backup antes de qualquer
// coisa, e só continua se o backup tiver sido gravado.
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { criarBackup } from "../services/backupService";

async function main() {
  // A flag existe para que um "seta pra cima + enter" distraído no terminal do
  // servidor não apague o histórico da loja.
  if (!process.argv.includes("--confirmar")) {
    const [movimentacoes, produtos, categorias, usuarios] = await Promise.all([
      prisma.movimentacao.count(),
      prisma.produto.count(),
      prisma.categoria.count(),
      prisma.usuario.count(),
    ]);

    console.log(
      `\nEste comando vai APAGAR do banco:\n` +
        `  ${movimentacoes} movimentações\n` +
        `  ${produtos} produtos\n` +
        `  ${categorias} categorias\n\n` +
        `E vai PRESERVAR:\n` +
        `  ${usuarios} usuários (senhas e perfis intactos)\n\n` +
        `Um backup é gravado antes de apagar qualquer coisa.\n` +
        `Para executar de verdade, repita o comando com --confirmar:\n\n` +
        `  npm run limpar-dados -- --confirmar\n`
    );
    return;
  }

  // Backup primeiro. Se ele falhar, a exceção sobe e o catch lá embaixo
  // encerra o processo — nada é apagado sem cópia de segurança gravada.
  console.log("Gerando backup antes de apagar...");
  const backup = await criarBackup();
  console.log(`Backup salvo em ${backup.destino} (${backup.tamanhoMb} MB)\n`);

  // A ordem importa: Movimentacao aponta para Produto, que aponta para
  // Categoria. Apagar na ordem inversa violaria a chave estrangeira.
  const movimentacoes = await prisma.movimentacao.deleteMany();
  const produtos = await prisma.produto.deleteMany();
  const categorias = await prisma.categoria.deleteMany();

  const usuarios = await prisma.usuario.count();

  console.log(
    `\nBanco limpo:\n` +
      `  ${movimentacoes.count} movimentações apagadas\n` +
      `  ${produtos.count} produtos apagados\n` +
      `  ${categorias.count} categorias apagadas\n` +
      `  ${usuarios} usuários preservados\n`
  );
  console.log(
    "Os aparelhos que já usaram o app guardam um cache local (Dexie) do\n" +
      "catálogo antigo. Em cada celular, saia e entre de novo no app para\n" +
      "baixar o catálogo limpo.\n"
  );
}

main()
  .catch((erro) => {
    console.error("\nFalhou — nada foi apagado:", erro instanceof Error ? erro.message : erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
