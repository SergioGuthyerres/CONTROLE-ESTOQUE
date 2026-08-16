// Cria (ou reseta) o usuário administrador dos donos em produção.
//
//   npm run criar-admin -- --nome dona.maria
//
// A senha nunca vem de argumento de linha de comando: argumentos ficam
// gravados no histórico do shell (~/.bash_history) e aparecem para qualquer
// processo da máquina em `ps aux`. Aqui ela é digitada com o eco desligado
// ou gerada pelo próprio servidor e mostrada uma única vez.
// Este script não importa src/lib/env.ts (não precisa de JWT_SECRET), então
// precisa carregar o .env por conta própria — senão o Prisma não encontra
// DATABASE_URL quando rodado em desenvolvimento.
import "dotenv/config";
import { createInterface } from "node:readline";
import { prisma } from "../lib/prisma";
import { esquemaSenha, gerarHashSenha, gerarSenhaAleatoria } from "../lib/senha";

function lerArgumento(nome: string): string | undefined {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

// Lê do terminal sem imprimir o que está sendo digitado. Sem isto a senha do
// dono fica visível na tela — e num monitor de loja isso é o mesmo que anotá-la
// num papel.
function perguntarOculto(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    const leitor = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // _writeToOutput é o gancho que o readline usa para ecoar cada tecla.
    // Substituí-lo é a forma padrão de esconder a digitação; mostramos "*"
    // para que quem digita ainda veja que a tecla foi registrada.
    let ocultando = false;
    const interno = leitor as unknown as { _writeToOutput: (texto: string) => void };
    interno._writeToOutput = (texto: string) => {
      if (!ocultando) return void process.stdout.write(texto);
      // O readline reescreve a linha inteira a cada tecla; só nos interessa
      // marcar caractere digitado, ignorando as sequências de controle.
      if (texto.includes(pergunta)) return void process.stdout.write("");
      process.stdout.write("*");
    };

    process.stdout.write(pergunta);
    ocultando = true;

    leitor.question("", (resposta) => {
      ocultando = false;
      process.stdout.write("\n");
      leitor.close();
      resolve(resposta.trim());
    });
  });
}

async function main() {
  const nome = (lerArgumento("nome") ?? "").trim();
  const gerarSenha = process.argv.includes("--gerar-senha");

  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(nome)) {
    console.error(
      "\nInforme o nome de usuário:\n" +
        "  npm run criar-admin -- --nome dona.maria\n" +
        "  npm run criar-admin -- --nome dona.maria --gerar-senha\n\n" +
        "Use apenas letras, números, ponto, hífen ou sublinhado (3 a 60 caracteres).\n"
    );
    process.exit(1);
  }

  // Evita o acidente de recriar o "admin" genérico que o README publicava.
  if (["admin", "administrador", "root", "funcionario"].includes(nome.toLowerCase())) {
    console.error(
      `\nO nome "${nome}" é genérico demais e é o primeiro que qualquer ataque tenta.\n` +
        "Use o nome real do dono (ex: dona.maria, seu.jose).\n"
    );
    process.exit(1);
  }

  const jaExiste = await prisma.usuario.findUnique({ where: { nome } });

  let senha: string;
  let senhaFoiGerada = false;

  if (gerarSenha) {
    senha = gerarSenhaAleatoria(18);
    senhaFoiGerada = true;
  } else {
    senha = await perguntarOculto(`Senha para "${nome}" (mínimo 10 caracteres, não aparece na tela): `);
    const confirmacao = await perguntarOculto("Digite a senha de novo para confirmar: ");

    if (senha !== confirmacao) {
      console.error("\nAs senhas não conferem. Nada foi alterado.\n");
      process.exit(1);
    }

    const validacao = esquemaSenha.safeParse(senha);
    if (!validacao.success) {
      console.error(`\n${validacao.error.issues[0]?.message}\nNada foi alterado.\n`);
      process.exit(1);
    }
  }

  const senhaHash = await gerarHashSenha(senha);

  const usuario = await prisma.usuario.upsert({
    where: { nome },
    // Se o usuário já existia, isto é um reset de senha: o incremento de
    // tokenVersion derruba qualquer sessão aberta com a senha antiga.
    update: {
      senhaHash,
      perfil: "admin",
      ativo: true,
      // Senha gerada pela máquina é provisória por definição — o dono troca no
      // primeiro acesso. Senha digitada por ele já é a definitiva.
      precisaTrocarSenha: senhaFoiGerada,
      tokenVersion: { increment: 1 },
    },
    create: {
      nome,
      senhaHash,
      perfil: "admin",
      precisaTrocarSenha: senhaFoiGerada,
    },
  });

  console.log(`\n${jaExiste ? "Senha redefinida" : "Administrador criado"}: ${usuario.nome}`);

  if (senhaFoiGerada) {
    console.log("\n  Senha provisória (anote agora, não será mostrada de novo):\n");
    console.log(`      ${senha}\n`);
    console.log("  O sistema vai exigir a troca dessa senha no primeiro acesso.");
  }

  if (jaExiste) {
    console.log("\n  As sessões abertas nesse usuário foram encerradas.");
  }
  console.log("");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
