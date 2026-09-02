// Espelha backend/src/lib/enums.ts — como são só 2 apps num monorepo pequeno,
// duplicar essa lista estática é mais simples do que criar um pacote
// compartilhado. Se algum dia sair do lugar, o backend rejeita na validação
// (zod), então o pior caso é uma mensagem de erro, não dado inconsistente.
import type { MotivoMovimentacao, TipoMovimentacao, Unidade } from "../db/db";

// A ordem aqui é a ordem do seletor de unidade no cadastro de produto, e o
// rótulo explica onde cada uma se aplica — quem cadastra é a dona da loja, não
// alguém que já sabe o que "un" quer dizer num sistema.
export const UNIDADES: { valor: Unidade; rotulo: string }[] = [
  { valor: "kg", rotulo: "kg — peso (inclui fardo e saco)" },
  { valor: "L", rotulo: "L — volume" },
  { valor: "un", rotulo: "un — unidade (balde, vassoura, cabo)" },
];

// Rótulos para exibir uma movimentação que já existe (histórico, relatórios).
// Inclui "estorno", que NÃO aparece em MOTIVOS_POR_TIPO logo abaixo porque
// ninguém escolhe esse motivo na tela — ele só nasce quando um admin desfaz
// uma movimentação pelo histórico.
export const ROTULO_MOTIVO: Record<MotivoMovimentacao, string> = {
  compra: "Compra",
  devolucao: "Devolução",
  venda: "Venda",
  perda: "Perda",
  uso_interno: "Uso interno",
  inventario: "Ajuste de inventário",
  estorno: "Estorno",
};

export const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

export const MOTIVOS_POR_TIPO: Record<TipoMovimentacao, { valor: MotivoMovimentacao; rotulo: string }[]> = {
  entrada: [
    { valor: "compra", rotulo: "Compra" },
    { valor: "devolucao", rotulo: "Devolução" },
    { valor: "inventario", rotulo: "Ajuste de inventário (achou a mais)" },
  ],
  saida: [
    { valor: "venda", rotulo: "Venda" },
    { valor: "perda", rotulo: "Perda" },
    { valor: "uso_interno", rotulo: "Uso interno" },
    { valor: "inventario", rotulo: "Ajuste de inventário (achou a menos)" },
  ],
};
