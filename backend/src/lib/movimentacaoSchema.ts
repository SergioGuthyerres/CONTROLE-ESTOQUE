import { z } from "zod";
import {
  FORMAS_PAGAMENTO,
  MOTIVOS_MOVIMENTACAO,
  MOTIVOS_POR_TIPO,
  TIPOS_MOVIMENTACAO,
  ehVenda,
} from "./enums";

// Validação do que entra por POST /movimentacoes/sync — o único caminho de
// escrita de movimentação do sistema.
//
// Mora em lib/ e não junto da rota porque estas regras SÃO a regra de negócio
// da entrada de dados, e regra de negócio testável não deve precisar levantar
// um servidor nem um banco. Ver testes/vendaFiado.test.ts.

// A data vem do relógio do celular, não do servidor — é o preço de aceitar
// lançamento offline (RNF02). Mas sem limite nenhum um cliente adulterado
// consegue plantar movimentação com data de 2019 ou de 2030 e sujar todo o
// histórico e os relatórios por período (RF11/RF13). A folga cobre relógio
// desregulado e celular que ficou dias sem internet; fora disso, recusa.
const TOLERANCIA_FUTURO_MS = 24 * 60 * 60 * 1000; // 1 dia
const TOLERANCIA_PASSADO_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

export const movimentacaoSchema = z
  .object({
    id: z.string().uuid(), // gerado no cliente — permite sincronização idempotente
    produtoId: z.string().min(1).max(60),
    tipo: z.enum(TIPOS_MOVIMENTACAO),
    motivo: z.enum(MOTIVOS_MOVIMENTACAO),
    // Teto de sanidade: o maior lançamento plausível da loja está muito abaixo
    // disso, e sem teto um erro de digitação (ou um cliente adulterado) faz o
    // estoque e o valor total do RF12 explodirem.
    quantidade: z.number().positive().finite().max(1_000_000),
    valor: z.number().nonnegative().finite().max(10_000_000).default(0),
    origemDispositivo: z.string().min(1).max(100),
    // Opcionais porque só existem em venda — e porque um PWA mais antigo que
    // esta versão não manda nenhum dos dois. Ver as regras logo abaixo.
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    cliente: z.string().trim().min(2).max(80).optional(),
    criadoEm: z.coerce
      .date()
      .refine(
        (data) => data.getTime() <= Date.now() + TOLERANCIA_FUTURO_MS,
        "Data da movimentação está no futuro — verifique a data e a hora do aparelho"
      )
      .refine(
        (data) => data.getTime() >= Date.now() - TOLERANCIA_PASSADO_MS,
        "Data da movimentação é antiga demais (mais de 90 dias) para ser sincronizada"
      ),
  })
  .refine((dado) => MOTIVOS_POR_TIPO[dado.tipo].includes(dado.motivo), {
    message: "Motivo não é válido para o tipo informado",
    path: ["motivo"],
  })
  // Forma de pagamento e cliente só existem em venda. Aceitá-los numa perda ou
  // num ajuste de inventário criaria linhas que os relatórios de fiado
  // contariam sem que ninguém entendesse de onde vieram.
  .refine((dado) => ehVenda(dado.tipo, dado.motivo) || dado.formaPagamento === undefined, {
    message: "Forma de pagamento só se aplica a venda",
    path: ["formaPagamento"],
  })
  .refine((dado) => ehVenda(dado.tipo, dado.motivo) || dado.cliente === undefined, {
    message: "Cliente só se aplica a venda",
    path: ["cliente"],
  })
  // Fiado sem nome é dívida que ninguém consegue cobrar. É a única informação
  // que a lista de devedores tem para trabalhar, então é exigida na entrada e
  // não descoberta na hora de cobrar.
  .refine((dado) => dado.formaPagamento !== "fiado" || !!dado.cliente, {
    message: "Venda fiado precisa do nome de quem levou",
    path: ["cliente"],
  })
  // O contrário também: nome de cliente numa venda à vista sugere que alguém
  // quis marcar fiado e esqueceu de trocar a forma — melhor recusar do que
  // gravar uma dívida que não vai aparecer em lugar nenhum.
  .refine((dado) => dado.formaPagamento === "fiado" || !dado.cliente, {
    message: "Só venda fiado registra cliente",
    path: ["cliente"],
  });

export const syncSchema = z.object({
  movimentacoes: z.array(movimentacaoSchema).min(1).max(200),
});
