// Espelha backend/src/lib/enums.ts — como são só 2 apps num monorepo pequeno,
// duplicar essa lista estática é mais simples do que criar um pacote
// compartilhado. Se algum dia sair do lugar, o backend rejeita na validação
// (zod), então o pior caso é uma mensagem de erro, não dado inconsistente.
import type { MotivoMovimentacao, TipoMovimentacao } from "../db/db";

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
