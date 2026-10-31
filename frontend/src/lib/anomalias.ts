// Lançamento que não parece certo.
//
// Puro de propósito (nenhum import de Dexie nem de React): são as regras que
// decidem se um lançamento entra, se entra depois de alguém confirmar, ou se
// não entra de jeito nenhum. Ver testes/anomalias.test.ts.
//
// Duas severidades, e a diferença é o que evita que o aviso vire paisagem:
//
// - BLOQUEIO é o que nunca pode ser gravado, porque entra errado e, como
//   Movimentacao é append-only, fica errado para sempre. O botão não libera.
// - CONFIRMAÇÃO é o que pode ser verdade, mas raramente é. Avisa, explica, e
//   quem decide é a pessoa no balcão.
//
// Tudo isso mora no cliente. O servidor não recusa nenhum destes casos — ver
// a decisão registrada em docs/ARCHITECTURE.md e o contador em
// backend/src/lib/anomalias.ts, que só conta o que já está gravado para o
// Resumo do Dia mostrar.

import type { MotivoMovimentacao, TipoMovimentacao } from "../db/db";

export type Severidade = "bloqueio" | "confirmacao";

export interface Anomalia {
  codigo: string;
  severidade: Severidade;
  mensagem: string;
}

export interface Lancamento {
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  unidade: string;
  produtoNome: string;
  // Null quando ainda não foi calculado.
  estoqueConhecido: number | null;
  // Datas (ISO) de lançamentos idênticos já feitos neste aparelho.
  identicosRecentes?: string[];
}

// Motivos em que dinheiro muda de mão. Os de fora não têm valor por natureza:
// perda, uso interno e ajuste de inventário mexem só no estoque.
export const MOTIVOS_QUE_EXIGEM_VALOR: readonly MotivoMovimentacao[] = [
  "venda",
  "compra",
  "devolucao",
];

export const QUANTIDADE_ALTA = 1000;
export const VALOR_ALTO = 5000;
export const JANELA_REPETICAO_MS = 2 * 60 * 1000;

export function exigeValor(motivo: MotivoMovimentacao): boolean {
  return MOTIVOS_QUE_EXIGEM_VALOR.includes(motivo);
}

// Um lançamento igualzinho feito há poucos minutos quase nunca é uma segunda
// venda igual: é a mesma venda registrada duas vezes porque ninguém teve
// certeza de que a primeira pegou. É o erro que a confirmação na tela
// inicial já ataca; aqui é a segunda rede.
export function repetidaRecente(
  identicosRecentes: string[] | undefined,
  agora = Date.now(),
  janelaMs = JANELA_REPETICAO_MS,
): boolean {
  return (identicosRecentes ?? []).some((iso) => {
    const quando = new Date(iso).getTime();
    return Number.isFinite(quando) && agora - quando >= 0 && agora - quando <= janelaMs;
  });
}

function reais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function conferir(lancamento: Lancamento, agora = Date.now()): Anomalia[] {
  const achadas: Anomalia[] = [];
  const { tipo, motivo, quantidade, valor, unidade, estoqueConhecido } = lancamento;

  // --- bloqueios ---------------------------------------------------------

  // Venda com valor zero some do relatório do dia: o estoque baixa, o caixa
  // não fecha, e olhando só o histórico ninguém descobre por quê. A mensagem
  // aponta a saída certa em vez de mandar inventar um número — saída sem
  // dinheiro existe, só não se chama venda.
  if (exigeValor(motivo) && !(valor > 0)) {
    achadas.push({
      codigo: "valor_zerado",
      severidade: "bloqueio",
      mensagem:
        tipo === "saida"
          ? "Saída com valor R$ 0,00 não pode ser venda. Se não entrou dinheiro, troque o motivo para perda, uso interno ou ajuste de inventário."
          : "Entrada com valor R$ 0,00 não pode ser compra. Se não saiu dinheiro, troque o motivo para ajuste de inventário.",
    });
  }

  // "un" é o que se conta: balde, vassoura, cabo de enxada. Meia vassoura não
  // sai da prateleira, então quase sempre é a vírgula do preço digitada no
  // campo errado.
  if (unidade === "un" && Number.isFinite(quantidade) && !Number.isInteger(quantidade)) {
    achadas.push({
      codigo: "fracao_contavel",
      severidade: "bloqueio",
      mensagem: `${lancamento.produtoNome} é contado por unidade, então ${quantidade} não existe. Confira se o valor não foi digitado no campo da quantidade.`,
    });
  }

  // --- confirmações ------------------------------------------------------

  if (quantidade > QUANTIDADE_ALTA) {
    achadas.push({
      codigo: "quantidade_alta",
      severidade: "confirmacao",
      mensagem: `${quantidade} ${unidade} é bem acima do normal da loja. Confira se não sobrou um zero.`,
    });
  }

  if (valor > VALOR_ALTO) {
    achadas.push({
      codigo: "valor_alto",
      severidade: "confirmacao",
      mensagem: `${reais(valor)} é bem acima do normal. Confira se é o valor da operação inteira e não um erro de digitação.`,
    });
  }

  // Aviso e não bloqueio: o estoque pode estar atrás da realidade porque a
  // entrada ainda não foi lançada, e travar a venda do balcão por isso seria
  // pior do que o número negativo, que o RF10 já aponta depois.
  if (tipo === "saida" && estoqueConhecido !== null && quantidade > estoqueConhecido) {
    achadas.push({
      codigo: "estoque_negativo",
      severidade: "confirmacao",
      mensagem: `O estoque conhecido é ${estoqueConhecido} ${unidade} e a saída é de ${quantidade}. Pode faltar lançar uma entrada — depois disso o estoque fica negativo.`,
    });
  }

  if (repetidaRecente(lancamento.identicosRecentes, agora)) {
    achadas.push({
      codigo: "repetida",
      severidade: "confirmacao",
      mensagem: `Um lançamento igual a este foi feito há poucos minutos neste aparelho. É uma segunda operação de verdade, ou a mesma registrada duas vezes?`,
    });
  }

  return achadas;
}

export function bloqueios(anomalias: Anomalia[]): Anomalia[] {
  return anomalias.filter((a) => a.severidade === "bloqueio");
}

export function confirmacoes(anomalias: Anomalia[]): Anomalia[] {
  return anomalias.filter((a) => a.severidade === "confirmacao");
}
