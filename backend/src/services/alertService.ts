import { prisma } from "../lib/prisma";
import { calcularEstoqueEmLote } from "./stockService";

export interface Alerta {
  produtoId: string;
  produtoNome: string;
  tipo: "negativo" | "minimo";
  estoqueAtual: number;
}

// RF09 (estoque mínimo) + RF10 (estoque negativo) — usado pela rota /alertas
// e pelo resumo do /dashboard, então fica num só lugar.
export async function listarAlertas(): Promise<Alerta[]> {
  const produtos = await prisma.produto.findMany();
  const estoquePorProduto = await calcularEstoqueEmLote(produtos.map((p) => p.id));

  return produtos
    .map((produto): Alerta | null => {
      const estoqueAtual = estoquePorProduto[produto.id] ?? 0;
      if (estoqueAtual < 0) {
        return { produtoId: produto.id, produtoNome: produto.nome, tipo: "negativo", estoqueAtual };
      }
      if (estoqueAtual < Number(produto.estoqueMinimo)) {
        return { produtoId: produto.id, produtoNome: produto.nome, tipo: "minimo", estoqueAtual };
      }
      return null;
    })
    .filter((alerta): alerta is Alerta => alerta !== null);
}
