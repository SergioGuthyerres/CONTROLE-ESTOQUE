// Popula o banco com usuários e produtos de exemplo — SOMENTE para dev/testes.
// Rodar com: npm run seed:dev
//
// As senhas são SORTEADAS a cada execução e impressas no terminal, em vez de
// escritas aqui e documentadas no README. Senha de exemplo publicada num
// repositório público é senha real no dia em que alguém a reaproveita — e,
// antes disso, é um alarme para quem abre o repositório. Em produção o
// usuário do dono é criado por `npm run criar-admin`.
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { gerarHashSenha, gerarSenhaAleatoria } from "../lib/senha";

async function main() {
  // Este bloqueio separa "banco de desenvolvimento" de "porta aberta em
  // produção". Mesmo com senha sorteada, um seed distraído no servidor
  // criaria usuários que ninguém pediu, com senhas que ficaram num terminal.
  if (env.emProducao) {
    console.error(
      "\nRecusando rodar o seed com NODE_ENV=production.\n" +
        "Ele cria usuários de exemplo que não deveriam existir no banco da loja.\n" +
        "Para criar o usuário dos donos em produção use: npm run criar-admin\n"
    );
    process.exit(1);
  }

  const senhaAdmin = gerarSenhaAleatoria(12);
  const senhaFuncionario = gerarSenhaAleatoria(12);

  // `update` também troca o hash: o seed é rodado várias vezes durante o
  // desenvolvimento, e uma senha impressa que não funciona porque o usuário
  // já existia é pior do que não imprimir nada.
  await prisma.usuario.upsert({
    where: { nome: "admin" },
    update: { senhaHash: await gerarHashSenha(senhaAdmin) },
    create: { nome: "admin", senhaHash: await gerarHashSenha(senhaAdmin), perfil: "admin" },
  });

  await prisma.usuario.upsert({
    where: { nome: "funcionario" },
    update: { senhaHash: await gerarHashSenha(senhaFuncionario) },
    create: {
      nome: "funcionario",
      senhaHash: await gerarHashSenha(senhaFuncionario),
      perfil: "funcionario",
    },
  });

  const racao = await prisma.categoria.upsert({
    where: { nome: "Ração" },
    update: {},
    create: { nome: "Ração" },
  });
  const graos = await prisma.categoria.upsert({
    where: { nome: "Grãos" },
    update: {},
    create: { nome: "Grãos" },
  });

  await prisma.produto.upsert({
    where: { id: "seed-produto-racao-caes" },
    update: {},
    create: {
      id: "seed-produto-racao-caes",
      nome: "Ração para cães 25kg",
      categoriaId: racao.id,
      unidade: "kg",
      estoqueMinimo: 30,
    },
  });

  await prisma.produto.upsert({
    where: { id: "seed-produto-milho" },
    update: {},
    create: {
      id: "seed-produto-milho",
      nome: "Milho em grão",
      categoriaId: graos.id,
      unidade: "kg",
      estoqueMinimo: 50,
    },
  });

  console.log(
    [
      "",
      "Seed concluído. Estas senhas valem só neste banco de desenvolvimento",
      "e mudam a cada execução — não vão para o repositório:",
      "",
      `  admin        ${senhaAdmin}`,
      `  funcionario  ${senhaFuncionario}`,
      "",
    ].join("\n"),
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
