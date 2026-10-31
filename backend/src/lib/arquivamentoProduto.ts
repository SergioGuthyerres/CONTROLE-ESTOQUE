// Remover um produto do cadastro: quando dá para apagar de verdade e quando
// só dá para arquivar.
//
// Puro de propósito (nenhum import de Prisma), pelo mesmo motivo de
// estornoService.ts e fiado.ts: a decisão é regra de negócio, e regra de
// negócio testável não deve precisar de banco. Ver testes/arquivamentoProduto.test.ts.

import { ErroHttp } from "./erroHttp";

export interface VinculosDoProduto {
  // Quantas movimentações existem para este produto, de qualquer tipo —
  // inclusive estornadas. Uma movimentação estornada continua sendo duas
  // linhas no histórico, e o histórico é justamente o que se preserva.
  movimentacoes: number;
}

export type AcaoDeRemocao = "excluir" | "arquivar";

// A regra inteira em uma linha: histórico zero, apaga; histórico qualquer,
// arquiva.
//
// Produto sem nenhuma movimentação é um cadastro que nunca existiu de fato —
// o duplicado digitado errado, o teste que ficou. Apagar não perde nada e
// deixa a lista limpa, que é o pedido real de quem tem 303 produtos onde
// deveria haver uns poucos.
export function acaoParaRemover(vinculos: VinculosDoProduto): AcaoDeRemocao {
  return vinculos.movimentacoes === 0 ? "excluir" : "arquivar";
}

// Barreira de servidor para o DELETE. A tela já pergunta antes, mas a tela é
// só a primeira linha: quem chama a API direto também não pode apagar
// histórico.
export function garantirQuePodeExcluir(vinculos: VinculosDoProduto): void {
  if (acaoParaRemover(vinculos) === "excluir") return;

  throw new ErroHttp(
    409,
    `Este produto tem ${vinculos.movimentacoes} ${
      vinculos.movimentacoes === 1 ? "movimentação" : "movimentações"
    } no histórico e não pode ser apagado. Arquive-o: ele some das telas de venda e compra, e o histórico continua inteiro.`,
  );
}

// Texto da confirmação, aqui e não na tela, para que a contagem e a palavra
// usada ("apagar" x "arquivar") nasçam da mesma regra que decide a ação. Tela
// e servidor dizendo coisas diferentes sobre a mesma operação é como se
// aprende a não ler o aviso.
export function avisoDaRemocao(nome: string, vinculos: VinculosDoProduto): string {
  if (acaoParaRemover(vinculos) === "excluir") {
    return `"${nome}" nunca foi movimentado. Ele será apagado do cadastro e isso não afeta nenhum registro de estoque.`;
  }

  const n = vinculos.movimentacoes;
  return `"${nome}" tem ${n} ${n === 1 ? "registro" : "registros"} de estoque no histórico. Ele será arquivado: some das telas de venda, compra e busca, e ${
    n === 1 ? "o registro continua" : "os registros continuam"
  } no histórico e nos relatórios. Dá para desarquivar depois.`;
}
