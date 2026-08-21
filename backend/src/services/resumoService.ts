import { prisma } from "../lib/prisma";
import type { MotivoMovimentacao, TipoMovimentacao } from "../lib/enums";
import { grupoDoMotivo, type GrupoDoResumo } from "../lib/gruposDeMovimentacao";

// Reexportado por conveniência de quem já importa o resumo inteiro.
export { grupoDoMotivo };
export type { GrupoDoResumo };

// Resumo de um período para conferência de caixa: quanto entrou de compra,
// quanto saiu de venda, e o que mais aconteceu.
//
// Por que não dá para responder isso com o histórico já existente: o
// histórico é uma lista cronológica de 50 linhas. Quem fecha o dia não quer
// ler 50 linhas, quer três números e a lista do que girou. São perguntas
// diferentes, e uma tela que serve às duas não serve bem a nenhuma.

export interface LinhaDoResumo {
  produtoId: string;
  produtoNome: string;
  unidade: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  movimentacoes: number;
}

export interface GrupoResumido {
  movimentacoes: number;
  valorTotal: number;
  linhas: LinhaDoResumo[];
}

export type ResumoDoPeriodo = Record<GrupoDoResumo, GrupoResumido>;

function grupoVazio(): GrupoResumido {
  return { movimentacoes: 0, valorTotal: 0, linhas: [] };
}

export async function resumirPeriodo(
  dataInicio: Date,
  dataFim: Date,
): Promise<ResumoDoPeriodo> {
  // Agrupado no banco, não em memória: o dia mais movimentado tem algumas
  // centenas de linhas hoje, mas a tabela é append-only e só cresce — trazer
  // tudo para somar aqui seria uma conta que piora todo mês.
  const agrupado = await prisma.movimentacao.groupBy({
    by: ["produtoId", "tipo", "motivo"],
    where: { criadoEm: { gte: dataInicio, lte: dataFim } },
    _sum: { quantidade: true, valor: true },
    _count: { _all: true },
  });

  // Tipo anotado à mão: o `select` do Prisma só devolve tipo de verdade depois
  // de `prisma generate`, e sem a anotação o typecheck passa a depender de o
  // cliente ter sido gerado — o que faz o erro aparecer em máquina de gente e
  // não no CI, ou o contrário.
  const produtos: { id: string; nome: string; unidade: string }[] =
    await prisma.produto.findMany({
      where: { id: { in: agrupado.map((linha) => linha.produtoId) } },
      select: { id: true, nome: true, unidade: true },
    });
  const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

  const resumo: ResumoDoPeriodo = {
    vendas: grupoVazio(),
    compras: grupoVazio(),
    outras: grupoVazio(),
  };

  for (const linha of agrupado) {
    const tipo = linha.tipo as TipoMovimentacao;
    const motivo = linha.motivo as MotivoMovimentacao;
    const produto = produtoPorId.get(linha.produtoId);
    const grupo = resumo[grupoDoMotivo(tipo, motivo)];

    const quantidade = Number(linha._sum.quantidade ?? 0);
    const valor = Number(linha._sum.valor ?? 0);

    grupo.linhas.push({
      produtoId: linha.produtoId,
      produtoNome: produto?.nome ?? "(produto removido)",
      unidade: produto?.unidade ?? "",
      tipo,
      motivo,
      quantidade,
      valor,
      movimentacoes: linha._count._all,
    });
    grupo.movimentacoes += linha._count._all;
    grupo.valorTotal += valor;
  }

  // Maior valor primeiro: quem confere o caixa quer ver a linha grande antes
  // de gastar atenção com a de dois reais.
  for (const grupo of Object.values(resumo)) {
    grupo.linhas.sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade);
  }

  return resumo;
}
