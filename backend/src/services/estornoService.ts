import { ErroHttp } from "../lib/erroHttp";
import {
  MOTIVO_ESTORNO,
  tipoInverso,
  type MotivoMovimentacao,
  type TipoMovimentacao,
} from "../lib/enums";

// "Desfazer" uma movimentação sem quebrar a regra 2 da arquitetura
// (Movimentacao é append-only: nunca UPDATE, nunca DELETE).
//
// O desfazer é uma movimentação nova, inversa, ligada à original por
// estornoDeId. Consequências, todas desejadas:
//
// - o estoque se corrige sozinho, porque estoque é a soma das movimentações
//   (não existe saldo para "voltar atrás");
// - o histórico continua contando a verdade: o erro aconteceu e foi
//   corrigido às 14h32 por fulano. Um DELETE apagaria o erro e, junto com
//   ele, a única pista de que alguém precisa de treinamento;
// - a sincronização de dois aparelhos continua sem conflito: some mais uma
//   linha, ninguém sobrescreve linha de ninguém.
//
// As funções deste arquivo são puras de propósito — a decisão de "pode
// estornar?" e "qual o inverso?" é a regra de negócio, e regra de negócio
// testável não deve precisar de banco. Ver testes/estorno.test.ts.

export interface MovimentacaoParaEstornar {
  id: string;
  tipo: string;
  motivo: string;
  quantidade: unknown; // Decimal do Prisma
  valor: unknown; // Decimal do Prisma
  produtoId: string;
  // Preenchido pelo `include` da rota: se já existe, esta movimentação já foi
  // desfeita uma vez.
  estorno?: { id: string } | null;
  // Idem: se existe, esta venda fiado já foi paga.
  pagamentoFiado?: { id: string } | null;
}

export interface DadosDoEstorno {
  produtoId: string;
  usuarioId: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  origemDispositivo: string;
  estornoDeId: string;
}

// Marca de origem dos estornos. Não é o id de um aparelho porque não veio de
// um: nasceu no painel, a pedido de um admin. Deixar isso explícito evita que
// uma investigação de estoque negativo saia procurando um celular que não
// existe (ver "origemDispositivo" em docs/especificacao-requisitos.md).
export const ORIGEM_ESTORNO = "painel-admin";

export function garantirQuePodeEstornar(original: MovimentacaoParaEstornar): void {
  if (original.motivo === MOTIVO_ESTORNO) {
    throw new ErroHttp(
      422,
      "Esta linha já é o estorno de outra movimentação. Para reverter, registre a movimentação de novo.",
    );
  }

  if (original.estorno) {
    throw new ErroHttp(409, "Esta movimentação já foi desfeita.");
  }

  // Desfazer uma venda fiado que já foi paga apagaria a venda e deixaria o
  // pagamento pendurado: a loja ficaria com um recibo de um dinheiro que
  // entrou por uma venda que o sistema diz que nunca existiu. Se o problema é
  // que a venda estava errada, o caminho é devolver o dinheiro e registrar
  // isso — não fingir que a venda não aconteceu.
  if (original.pagamentoFiado) {
    throw new ErroHttp(
      422,
      "Esta venda fiado já foi paga. Desfazer apagaria a venda e deixaria o pagamento sem origem.",
    );
  }
}

export function dadosDoEstorno(
  original: MovimentacaoParaEstornar,
  usuarioId: string,
): DadosDoEstorno {
  garantirQuePodeEstornar(original);

  return {
    produtoId: original.produtoId,
    usuarioId, // quem desfez, não quem lançou — é o dado útil na auditoria
    tipo: tipoInverso(original.tipo as TipoMovimentacao),
    motivo: MOTIVO_ESTORNO,
    quantidade: Number(original.quantidade),
    // O valor acompanha o inverso: desfazer uma compra de R$ 200 precisa tirar
    // os R$ 200 da conta do custo médio, senão o valor do estoque (RF12)
    // continua contando um dinheiro que não foi gasto.
    valor: Number(original.valor),
    origemDispositivo: ORIGEM_ESTORNO,
    estornoDeId: original.id,
  };
}
