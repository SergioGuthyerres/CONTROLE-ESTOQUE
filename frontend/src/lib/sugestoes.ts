import { db, type ProdutoLocal, type TipoMovimentacao } from "../db/db";

// Atalhos de produto na tela de registrar venda/compra.
//
// Duas fontes, e a ordem entre elas é a decisão que importa:
//
// 1. O que ESTE aparelho registrou nos últimos dias. É o sinal mais forte que
//    existe — quem está com o celular na mão hoje tende a repetir o que
//    lançou ontem — e é o único que funciona offline desde o primeiro toque.
// 2. O que a loja inteira mais movimentou, baixado junto com o catálogo. É o
//    que salva o aparelho novo (ou o funcionário novo), que não tem histórico
//    local nenhum e cairia numa tela sem atalho algum.
//
// O local vem primeiro e o do servidor completa o resto. O contrário faria a
// lista ignorar o que a pessoa acabou de fazer, que é a informação mais
// recente que o app tem.

export const MAXIMO_DE_SUGESTOES = 6;
const DIAS_DE_HISTORICO_LOCAL = 14;

/** Quantas vezes cada produto foi lançado neste aparelho, por tipo. */
export async function contagemLocalRecente(
  tipo: TipoMovimentacao,
  agora = new Date(),
): Promise<Map<string, number>> {
  const desde = new Date(agora.getTime() - DIAS_DE_HISTORICO_LOCAL * 24 * 60 * 60 * 1000);
  const recentes = await db.movimentacoes.where("criadoEm").aboveOrEqual(desde.toISOString()).toArray();

  const contagem = new Map<string, number>();
  for (const mov of recentes) {
    if (mov.tipo !== tipo) continue;
    contagem.set(mov.produtoId, (contagem.get(mov.produtoId) ?? 0) + 1);
  }
  return contagem;
}

// Puro de propósito: é a regra de ordenação, e é o que precisa de teste.
export function ordenarSugestoes(
  contagemLocal: Map<string, number>,
  idsDoServidor: string[],
  produtosConhecidos: Map<string, ProdutoLocal>,
  maximo = MAXIMO_DE_SUGESTOES,
): ProdutoLocal[] {
  const locaisOrdenados = [...contagemLocal.entries()]
    .sort(([idA, vezesA], [idB, vezesB]) => {
      if (vezesB !== vezesA) return vezesB - vezesA;
      // Empate resolvido pelo nome, não pela ordem do Map: um atalho que
      // troca de lugar a cada abertura obriga a ler a lista toda vez, e o
      // atalho existe justamente para não precisar ler.
      const nomeA = produtosConhecidos.get(idA)?.nome ?? "";
      const nomeB = produtosConhecidos.get(idB)?.nome ?? "";
      return nomeA.localeCompare(nomeB, "pt-BR");
    })
    .map(([id]) => id);

  const escolhidos: string[] = [];
  for (const id of [...locaisOrdenados, ...idsDoServidor]) {
    // Produto que sumiu do catálogo não vira atalho: tocar nele levaria a uma
    // tela de movimentação sem produto.
    if (!produtosConhecidos.has(id)) continue;
    if (escolhidos.includes(id)) continue;
    escolhidos.push(id);
    if (escolhidos.length === maximo) break;
  }

  return escolhidos.map((id) => produtosConhecidos.get(id)!);
}

export async function sugestoesDeProduto(tipo: TipoMovimentacao): Promise<ProdutoLocal[]> {
  const [contagem, doServidor, produtos] = await Promise.all([
    contagemLocalRecente(tipo),
    db.sugestoes.get(tipo),
    db.produtos.toArray(),
  ]);

  return ordenarSugestoes(
    contagem,
    doServidor?.produtoIds ?? [],
    new Map(produtos.map((p) => [p.id, p])),
  );
}
