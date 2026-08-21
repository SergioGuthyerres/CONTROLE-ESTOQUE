// Fonte única de verdade para os valores válidos que o Prisma/SQLite não
// consegue validar sozinho (SQLite não tem enum nativo — ver schema.prisma).
// Sempre importe destas listas em vez de repetir strings soltas.

export const PERFIS = ["funcionario", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

export const UNIDADES = ["kg", "L"] as const;
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

// Mapa de qual "motivo" é permitido para cada "tipo" — evita, por exemplo,
// registrar um "motivo: venda" dentro de um "tipo: entrada". É também a lista
// do que um humano pode escolher na tela: o que não está aqui, ninguém digita.
export const MOTIVOS_POR_TIPO: Record<TipoMovimentacao, MotivoMovimentacao[]> = {
  entrada: ["compra", "devolucao", "inventario"],
  saida: ["venda", "perda", "uso_interno", "inventario"],
};

export function tipoInverso(tipo: TipoMovimentacao): TipoMovimentacao {
  return tipo === "entrada" ? "saida" : "entrada";
}
