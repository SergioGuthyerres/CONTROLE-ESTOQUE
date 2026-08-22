import { ROTULO_ORDEM_MOTIVOS, type MotivoMovimentacao, type TipoMovimentacao } from "./enums";

// Monta o relatório de movimentação por produto a partir das linhas já
// agrupadas pelo banco. Puro de propósito: é a parte que decide o que o
// número significa, e é a parte que erra sem fazer barulho.
//
// O relatório antigo devolvia um total só: a soma de tudo que mexeu no
// produto, entrada e saída juntas. Isso responde "o que dá trabalho" e é
// legítimo, mas era o ÚNICO número, e ele é fácil de ler errado: 10 kg
// comprados e 10 kg vendidos viram "20 movimentados", que não é nem o que
// entrou, nem o que saiu, nem o que sobrou. Agora o total continua lá, com o
// nome do que ele é, acompanhado da quebra que responde as outras perguntas.

export interface LinhaAgrupada {
  produtoId: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  movimentacoes: number;
}

export interface ProdutoDoRelatorio {
  id: string;
  nome: string;
  unidade: string;
}

export interface DetalheDeMotivo {
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  movimentacoes: number;
}

export interface TotalPorTipo {
  quantidade: number;
  valor: number;
  movimentacoes: number;
}

export interface LinhaDoRelatorio {
  produtoId: string;
  produtoNome: string;
  unidade: string;
  /** Entradas + saídas somadas. É a medida de "quanto esse produto dá trabalho". */
  totalMovimentado: number;
  entradas: TotalPorTipo;
  saidas: TotalPorTipo;
  /** Entradas − saídas no período. Positivo = encheu, negativo = esvaziou. */
  saldo: number;
  porMotivo: DetalheDeMotivo[];
}

function zerado(): TotalPorTipo {
  return { quantidade: 0, valor: 0, movimentacoes: 0 };
}

export function montarRelatorioPorProduto(
  linhas: LinhaAgrupada[],
  produtos: ProdutoDoRelatorio[],
): LinhaDoRelatorio[] {
  const produtoPorId = new Map(produtos.map((p) => [p.id, p]));
  const porProduto = new Map<string, LinhaDoRelatorio>();

  for (const linha of linhas) {
    let atual = porProduto.get(linha.produtoId);
    if (!atual) {
      const produto = produtoPorId.get(linha.produtoId);
      atual = {
        produtoId: linha.produtoId,
        // Produto some do catálogo, movimentação não some do histórico: a
        // linha continua contando, com o nome dizendo o que aconteceu.
        produtoNome: produto?.nome ?? "(produto removido)",
        unidade: produto?.unidade ?? "",
        totalMovimentado: 0,
        entradas: zerado(),
        saidas: zerado(),
        saldo: 0,
        porMotivo: [],
      };
      porProduto.set(linha.produtoId, atual);
    }

    const lado = linha.tipo === "entrada" ? atual.entradas : atual.saidas;
    lado.quantidade += linha.quantidade;
    lado.valor += linha.valor;
    lado.movimentacoes += linha.movimentacoes;

    atual.totalMovimentado += linha.quantidade;
    atual.saldo += linha.tipo === "entrada" ? linha.quantidade : -linha.quantidade;
    atual.porMotivo.push({
      tipo: linha.tipo,
      motivo: linha.motivo,
      quantidade: linha.quantidade,
      valor: linha.valor,
      movimentacoes: linha.movimentacoes,
    });
  }

  for (const linha of porProduto.values()) {
    // Ordem fixa (a de enums.ts), não a que o banco devolveu: um relatório
    // que troca a ordem das linhas a cada consulta é impossível de comparar
    // com o da semana passada.
    linha.porMotivo.sort(
      (a, b) =>
        a.tipo.localeCompare(b.tipo) ||
        ROTULO_ORDEM_MOTIVOS.indexOf(a.motivo) - ROTULO_ORDEM_MOTIVOS.indexOf(b.motivo),
    );
  }

  return [...porProduto.values()].sort(
    (a, b) => b.totalMovimentado - a.totalMovimentado || a.produtoNome.localeCompare(b.produtoNome),
  );
}
