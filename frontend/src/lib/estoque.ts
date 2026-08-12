import { db, type ProdutoLocal } from "../db/db";

// Estoque "otimista" mostrado na tela: o último valor que o servidor
// confirmou (produto.estoqueAtualServidor) + o efeito das movimentações
// feitas neste aparelho que ainda não foram sincronizadas. Depois que a
// sincronização roda e o cache de produtos é atualizado, as pendentes já
// somadas somem da conta (viraram sincronizada=1), evitando contar em dobro.
export async function estoqueLocalDeProduto(produto: ProdutoLocal): Promise<number> {
  const pendentes = await db.movimentacoes
    .where({ produtoId: produto.id, sincronizada: 0 })
    .toArray();

  const efeitoPendentes = pendentes.reduce((soma, mov) => {
    return soma + (mov.tipo === "entrada" ? mov.quantidade : -mov.quantidade);
  }, 0);

  return produto.estoqueAtualServidor + efeitoPendentes;
}
