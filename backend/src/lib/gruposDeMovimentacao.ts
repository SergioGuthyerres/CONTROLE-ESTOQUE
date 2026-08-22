import type { MotivoMovimentacao, TipoMovimentacao } from "./enums";

// Em que caixinha da conferência de caixa cada movimentação entra.
//
// Mora em lib/ e não junto do serviço que monta o resumo pelo mesmo motivo de
// lib/erroHttp.ts: é regra de negócio pura, e regra de negócio testável não
// deve precisar do cliente do Prisma carregado para ser exercitada.
export type GrupoDoResumo = "vendas" | "compras" | "outras";

export function grupoDoMotivo(
  tipo: TipoMovimentacao,
  motivo: MotivoMovimentacao,
): GrupoDoResumo {
  if (tipo === "saida" && motivo === "venda") return "vendas";
  if (tipo === "entrada" && motivo === "compra") return "compras";
  // Perda, uso interno, devolução, ajuste de inventário e estorno mexem no
  // estoque mas não são o movimento comercial do dia. Ficam juntos, visíveis,
  // porque somá-los a vendas ou compras esconderia justamente o que precisa
  // de explicação — e faria o dia parecer melhor do que foi.
  return "outras";
}
