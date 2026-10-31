// Movimentação que não parece erro de digitação óbvio, mas também não parece
// certa.
//
// Puro de propósito, como estornoService.ts, fiado.ts e arquivamentoProduto.ts:
// a decisão é regra de negócio e precisa ser exercitável sem banco, sem
// servidor e sem token. Ver testes/anomalias.test.ts.
//
// **Este módulo não recusa nada.** Quem barra é a tela
// (frontend/src/lib/anomalias.ts, que espelha estas mesmas regras); aqui elas
// servem só para CONTAR o que já está gravado e mostrar no Resumo do Dia.
//
// A decisão está registrada em docs/ARCHITECTURE.md: o sistema é privado, e
// validar de novo no servidor custaria recusar o lote inteiro da
// sincronização — travando a fila daquele celular para sempre, que é pior do
// que o dado ruim. Mas o PWA se publica sozinho e o celular pode ficar
// semanas com o bundle em cache, então um aparelho com versão antiga continua
// gravando sem conhecer as regras novas. Contar e mostrar cobre esse caso sem
// nenhum dos riscos: ninguém é bloqueado, e o admin vê e corrige com estorno.

import type { MotivoMovimentacao, Unidade } from "./enums";

// Motivos em que dinheiro muda de mão. Venda sem valor é venda que some do
// relatório do dia: o estoque baixa, o caixa não fecha, e ninguém descobre
// por quê olhando só o histórico.
//
// Os de fora não têm valor por natureza — perda, uso interno e ajuste de
// inventário mexem só no estoque. É por isso que a mensagem manda trocar o
// motivo em vez de mandar inventar um número: saída sem dinheiro existe, só
// não se chama venda.
export const MOTIVOS_QUE_EXIGEM_VALOR: readonly MotivoMovimentacao[] = [
  "venda",
  "compra",
  "devolucao",
];

export function exigeValor(motivo: MotivoMovimentacao): boolean {
  return MOTIVOS_QUE_EXIGEM_VALOR.includes(motivo);
}

// Tetos do que é plausível nesta loja. Não são limites do sistema: são o
// ponto em que vale a pena alguém olhar duas vezes.
export const QUANTIDADE_ALTA = 1000;
export const VALOR_ALTO = 5000;

export type CodigoAnomalia = "valor_zerado" | "quantidade_alta" | "valor_alto" | "fracao_contavel";

export interface MovimentacaoParaConferir {
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  // Só o produto sabe se a unidade é contável; vem de quem consultou o banco.
  unidade?: Unidade | string;
}

export const DESCRICAO_ANOMALIA: Record<CodigoAnomalia, string> = {
  valor_zerado: "com valor R$ 0,00",
  quantidade_alta: `com quantidade acima de ${QUANTIDADE_ALTA}`,
  valor_alto: `com valor acima de R$ ${VALOR_ALTO.toLocaleString("pt-BR")}`,
  fracao_contavel: "com quantidade quebrada num produto que se conta por unidade",
};

// "un" é o que se conta: balde, vassoura, cabo de enxada. Meia vassoura não
// sai da prateleira, então 2,5 "un" é sempre erro — quase sempre a vírgula do
// preço digitada no campo da quantidade.
export function fracaoEmUnidadeContavel(unidade: string | undefined, quantidade: number): boolean {
  return unidade === "un" && Number.isFinite(quantidade) && !Number.isInteger(quantidade);
}

export function anomaliasDe(mov: MovimentacaoParaConferir): CodigoAnomalia[] {
  const achadas: CodigoAnomalia[] = [];

  if (exigeValor(mov.motivo) && !(mov.valor > 0)) achadas.push("valor_zerado");
  if (mov.quantidade > QUANTIDADE_ALTA) achadas.push("quantidade_alta");
  if (mov.valor > VALOR_ALTO) achadas.push("valor_alto");
  if (fracaoEmUnidadeContavel(mov.unidade, mov.quantidade)) achadas.push("fracao_contavel");

  return achadas;
}
