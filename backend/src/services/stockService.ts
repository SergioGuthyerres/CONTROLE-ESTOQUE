import { prisma } from "../lib/prisma";

// Regra central do sistema: o estoque NUNCA é um campo que se sobrescreve —
// é sempre recalculado somando as movimentações do produto (entrada soma,
// saida subtrai). Ver docs/documento-de-visao.md, seção 5.2, e
// docs/especificacao-requisitos.md, "Regras de negócio explícitas".
//
// Se um dia isso ficar lento (catálogo/histórico muito grandes), a saída é
// materializar um saldo em cache reconstruído a partir das movimentações —
// nunca um saldo que passa a ser a fonte da verdade.
export async function calcularEstoque(produtoId: string): Promise<number> {
  const [entradas, saidas] = await Promise.all([
    prisma.movimentacao.aggregate({
      where: { produtoId, tipo: "entrada" },
      _sum: { quantidade: true },
    }),
    prisma.movimentacao.aggregate({
      where: { produtoId, tipo: "saida" },
      _sum: { quantidade: true },
    }),
  ]);

  const totalEntradas = Number(entradas._sum.quantidade ?? 0);
  const totalSaidas = Number(saidas._sum.quantidade ?? 0);
  return totalEntradas - totalSaidas;
}

export async function calcularEstoqueEmLote(
  produtoIds: string[]
): Promise<Record<string, number>> {
  const movimentacoes = await prisma.movimentacao.groupBy({
    by: ["produtoId", "tipo"],
    where: { produtoId: { in: produtoIds } },
    _sum: { quantidade: true },
  });

  const estoquePorProduto: Record<string, number> = {};
  for (const id of produtoIds) estoquePorProduto[id] = 0;

  for (const linha of movimentacoes) {
    const quantidade = Number(linha._sum.quantidade ?? 0);
    const sinal = linha.tipo === "entrada" ? 1 : -1;
    estoquePorProduto[linha.produtoId] += sinal * quantidade;
  }

  return estoquePorProduto;
}

// RF12: o modelo de dados não guarda um "preço" fixo no Produto — o valor
// pago varia a cada entrada (compra). Por isso o valor do estoque atual usa
// o custo médio observado nas entradas (total pago / total recebido).
export async function calcularValorTotalEstoque() {
  const produtos = await prisma.produto.findMany();
  const produtoIds = produtos.map((p) => p.id);

  const [estoquePorProduto, entradasPorProduto] = await Promise.all([
    calcularEstoqueEmLote(produtoIds),
    prisma.movimentacao.groupBy({
      by: ["produtoId"],
      where: { produtoId: { in: produtoIds }, tipo: "entrada" },
      _sum: { quantidade: true, valor: true },
    }),
  ]);

  const custoMedioPorProduto: Record<string, number> = {};
  for (const linha of entradasPorProduto) {
    const quantidade = Number(linha._sum.quantidade ?? 0);
    const valor = Number(linha._sum.valor ?? 0);
    custoMedioPorProduto[linha.produtoId] = quantidade > 0 ? valor / quantidade : 0;
  }

  const linhas = produtos.map((produto) => {
    const estoqueAtual = estoquePorProduto[produto.id] ?? 0;
    const custoMedioUnitario = custoMedioPorProduto[produto.id] ?? 0;
    return {
      produtoId: produto.id,
      produtoNome: produto.nome,
      estoqueAtual,
      custoMedioUnitario,
      valorEstoque: estoqueAtual * custoMedioUnitario,
    };
  });

  const valorTotal = linhas.reduce((soma, linha) => soma + linha.valorEstoque, 0);
  return { linhas, valorTotal };
}
