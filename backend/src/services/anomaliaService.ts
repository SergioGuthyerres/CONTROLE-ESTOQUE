import { prisma } from "../lib/prisma";
import {
  anomaliasDe,
  DESCRICAO_ANOMALIA,
  type CodigoAnomalia,
} from "../lib/anomalias";
import type { MotivoMovimentacao } from "../lib/enums";

// Conta o que já está gravado e parece errado, para o Resumo do Dia mostrar.
//
// Não recusa nada e não corrige nada — ver o cabeçalho de src/lib/anomalias.ts
// e a decisão em docs/ARCHITECTURE.md. Existe porque o PWA se publica sozinho
// e o celular pode ficar semanas com o bundle em cache: um aparelho com versão
// antiga continua gravando sem conhecer as regras novas da tela, e sem isto
// ninguém ficaria sabendo.

export interface MovimentacaoSuspeita {
  id: string;
  produtoNome: string;
  motivo: string;
  quantidade: number;
  unidade: string;
  valor: number;
  criadoEm: string;
  usuario: string;
}

export interface GrupoDeAnomalia {
  codigo: CodigoAnomalia;
  descricao: string;
  movimentacoes: MovimentacaoSuspeita[];
}

export async function anomaliasDoPeriodo(
  dataInicio: Date,
  dataFim: Date,
): Promise<GrupoDeAnomalia[]> {
  const movimentacoes = await prisma.movimentacao.findMany({
    where: {
      criadoEm: { gte: dataInicio, lte: dataFim },
      // Estorno nasce no servidor e espelha o valor da original — um estorno
      // de perda tem valor zero por construção, e apontá-lo seria apontar o
      // próprio sistema. Movimentação já desfeita também sai: ela já foi
      // corrigida, e repetir o aviso só faria a lista crescer com o que já
      // está resolvido.
      motivo: { not: "estorno" },
      estorno: { is: null },
    },
    select: {
      id: true,
      motivo: true,
      quantidade: true,
      valor: true,
      criadoEm: true,
      produto: { select: { nome: true, unidade: true } },
      usuario: { select: { nome: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  const porCodigo = new Map<CodigoAnomalia, MovimentacaoSuspeita[]>();

  for (const mov of movimentacoes) {
    const quantidade = Number(mov.quantidade);
    const valor = Number(mov.valor);

    const achadas = anomaliasDe({
      motivo: mov.motivo as MotivoMovimentacao,
      quantidade,
      valor,
      unidade: mov.produto.unidade,
    });

    for (const codigo of achadas) {
      const lista = porCodigo.get(codigo) ?? [];
      lista.push({
        id: mov.id,
        produtoNome: mov.produto.nome,
        motivo: mov.motivo,
        quantidade,
        unidade: mov.produto.unidade,
        valor,
        criadoEm: mov.criadoEm.toISOString(),
        usuario: mov.usuario.nome,
      });
      porCodigo.set(codigo, lista);
    }
  }

  return [...porCodigo.entries()].map(([codigo, lista]) => ({
    codigo,
    descricao: DESCRICAO_ANOMALIA[codigo],
    movimentacoes: lista,
  }));
}
