import { db } from "../db/db";

// Nomes que já levaram fiado neste aparelho, para sugerir na tela de venda.
//
// Vem do que está gravado localmente, e não de uma rota nova, por dois
// motivos: a tela de venda precisa funcionar offline (RNF02), e o freguês que
// leva fiado é quase sempre alguém que já levou antes — quem atende no balcão
// tem o histórico dele no próprio aparelho.
//
// O objetivo real da sugestão não é economizar digitação: é evitar que o mesmo
// freguês vire "Antonio", "Antônio" e "seu antonio" na lista de devedores, e
// que a dívida dele apareça repartida em três nomes.
export async function clientesJaUsados(): Promise<string[]> {
  const vendas = await db.movimentacoes.where("formaPagamento").equals("fiado").toArray();

  const nomes = new Set<string>();
  for (const venda of vendas) {
    const nome = venda.cliente?.trim();
    if (nome) nomes.add(nome);
  }

  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
