// Fonte única de verdade para os valores válidos que o Prisma/SQLite não
// consegue validar sozinho (SQLite não tem enum nativo — ver schema.prisma).
// Sempre importe destas listas em vez de repetir strings soltas.

export const PERFIS = ["funcionario", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

// "un" é a unidade do que se conta em vez de pesar ou medir: balde, vassoura,
// cabo de enxada. Sem ela, esses produtos entravam como "kg" e o estoque
// passava a dizer "3 kg de vassoura" — número certo, leitura errada, e o
// alerta de estoque mínimo virava adivinhação para quem confere.
export const UNIDADES = ["kg", "L", "un"] as const;
export type Unidade = (typeof UNIDADES)[number];

// Só existem dois tipos — o sinal do estoque é sempre determinado por "tipo",
// sem exceção (entrada soma, saida subtrai; "quantidade" é sempre positiva).
// Ajuste de inventário/contagem NÃO é um terceiro tipo: se a contagem física
// achou mais produto do que o sistema tinha registrado, é uma "entrada" com
// motivo "inventario"; se achou menos, é uma "saida" com motivo "inventario".
// Isso evita ambiguidade de sinal — ver src/services/stockService.ts.
export const TIPOS_MOVIMENTACAO = ["entrada", "saida"] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];

export const MOTIVOS_MOVIMENTACAO = [
  "compra",
  "devolucao",
  "venda",
  "perda",
  "uso_interno",
  "inventario",
  // Só o servidor cria: é o motivo da movimentação inversa gerada ao desfazer
  // outra movimentação pelo histórico (ver src/services/estornoService.ts).
  // De propósito fora de MOTIVOS_POR_TIPO, logo abaixo — assim o zod da rota
  // de sincronização recusa um cliente que tente plantar um estorno à mão.
  "estorno",
] as const;
export type MotivoMovimentacao = (typeof MOTIVOS_MOVIMENTACAO)[number];

export const MOTIVO_ESTORNO = "estorno" satisfies MotivoMovimentacao;

// Ordem de exibição dos motivos em listas e relatórios. É a ordem de
// MOTIVOS_MOVIMENTACAO, num nome que deixa claro para que serve: um
// relatório que troca a ordem das linhas a cada consulta é impossível de
// comparar com o da semana passada.
export const ROTULO_ORDEM_MOTIVOS: readonly MotivoMovimentacao[] = MOTIVOS_MOVIMENTACAO;

// Mapa de qual "motivo" é permitido para cada "tipo" — evita, por exemplo,
// registrar um "motivo: venda" dentro de um "tipo: entrada". É também a lista
// do que um humano pode escolher na tela: o que não está aqui, ninguém digita.
// Como a venda foi paga. Só existe em venda (tipo "saida", motivo "venda") —
// compra, perda e ajuste não têm forma de pagamento, e a rota recusa se o
// campo vier preenchido nelas.
//
// "fiado" é a venda levada agora e paga depois, no caderno. É como metade das
// vendas da loja acontece, e antes disso o sistema não sabia distinguir: o
// total do dia somava dinheiro que ainda não tinha entrado.
export const FORMAS_PAGAMENTO = ["a_vista", "fiado"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const FORMA_PAGAMENTO_PADRAO = "a_vista" satisfies FormaPagamento;

// Onde uma venda pode ser paga depois. Usado pela rota de sincronização e pela
// lista de devedores; um lugar só para não sair do lugar.
export function ehVenda(tipo: string, motivo: string): boolean {
  return tipo === "saida" && motivo === "venda";
}

export const MOTIVOS_POR_TIPO: Record<TipoMovimentacao, MotivoMovimentacao[]> = {
  entrada: ["compra", "devolucao", "inventario"],
  saida: ["venda", "perda", "uso_interno", "inventario"],
};

export function tipoInverso(tipo: TipoMovimentacao): TipoMovimentacao {
  return tipo === "entrada" ? "saida" : "entrada";
}
