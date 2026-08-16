// Popula o banco com usuários e produtos de exemplo — SOMENTE para dev/testes.
// Rodar com: npm run seed
//
// As senhas abaixo estão num repositório público. Elas existem só para não
// atrapalhar quem está desenvolvendo; em produção o usuário do dono é criado
// por `npm run criar-admin`, com senha que ninguém mais conhece.
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { gerarHashSenha } from "../lib/senha";

async function main() {
  // Este bloqueio é o que separa "senha de exemplo" de "porta aberta em
  // produção". Sem ele, um `npm run seed` distraído no servidor recria o
  // usuário admin/admin123 — que está documentado publicamente no README.
  if (env.emProducao) {
    console.error(
      "\nRecusando rodar o seed com NODE_ENV=production.\n" +
        "Ele cria usuários com senhas de exemplo que são públicas neste repositório.\n" +
        "Para criar o usuário dos donos em produção use: npm run criar-admin\n"
    );
    process.exit(1);
  }

  const senhaAdmin = await gerarHashSenha("admin123");
  const senhaFuncionario = await gerarHashSenha("func123");

  await prisma.usuario.upsert({
    where: { nome: "admin" },
    update: {},
    create: { nome: "admin", senhaHash: senhaAdmin, perfil: "admin" },
  });

  await prisma.usuario.upsert({
    where: { nome: "funcionario" },
    update: {},
    create: { nome: "funcionario", senhaHash: senhaFuncionario, perfil: "funcionario" },
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

  console.log("Seed concluído. Usuários: admin/admin123 e funcionario/func123");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
