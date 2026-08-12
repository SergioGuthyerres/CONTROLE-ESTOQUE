// Popula o banco com usuários e alguns produtos de exemplo para dev/testes.
// Rodar com: npm run seed
import { prisma } from "../lib/prisma";
import { gerarHashSenha } from "../services/authService";

async function main() {
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
