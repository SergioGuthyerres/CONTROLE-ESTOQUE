import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao } from "../middleware/auth";
import { assincrono } from "../middleware/erros";
import { ErroHttp } from "../lib/erroHttp";
import { listarDevedores, type VendaFiado } from "../lib/fiado";

export const fiadoRouter = Router();

// Autenticação sim, perfil não: cobrar fiado é trabalho de balcão, e quem
// atende é o funcionário. Exigir admin aqui obrigaria a dona da loja a estar
// presente para receber R$ 20 — e o caderno de fiado nunca teve essa trava.
fiadoRouter.use(exigirAutenticacao);

// A lista de devedores: vendas fiado que ninguém pagou e ninguém desfez,
// agrupadas por pessoa. A regra de "o que ainda é dívida" está em
// src/lib/fiado.ts, pura e testada.
fiadoRouter.get("/devedores", assincrono(async (_req, res) => {
  const vendas = await prisma.movimentacao.findMany({
    where: { tipo: "saida", motivo: "venda", formaPagamento: "fiado" },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      cliente: true,
      valor: true,
      criadoEm: true,
      quantidade: true,
      produto: { select: { nome: true, unidade: true } },
      usuario: { select: { nome: true } },
      pagamentoFiado: { select: { id: true } },
      estorno: { select: { id: true } },
    },
  });

  const paraRegra: VendaFiado[] = vendas.map((v) => ({
    id: v.id,
    cliente: v.cliente,
    valor: Number(v.valor),
    criadoEm: v.criadoEm.toISOString(),
    produtoNome: v.produto.nome,
    quantidade: Number(v.quantidade),
    unidade: v.produto.unidade,
    vendidoPor: v.usuario.nome,
    pagamentoFiado: v.pagamentoFiado,
    estorno: v.estorno,
  }));

  const devedores = listarDevedores(paraRegra);
  const total = devedores.reduce((soma, d) => soma + d.total, 0);

  res.json({ devedores, total });
}));

// Um lote e não uma rota por dívida: quem paga costuma pagar tudo o que deve
// de uma vez. Fazendo N requisições, uma falha no meio deixaria metade da
// dívida baixada e metade não, e a tela não teria como explicar isso.
const baixaSchema = z.object({
  movimentacaoIds: z.array(z.string().min(1)).min(1).max(100),
});

// Dar baixa NÃO altera a venda — grava um recibo novo (PagamentoFiado), pelo
// mesmo motivo do estorno: Movimentacao é append-only. O que sai da lista de
// devedores sai porque passou a existir um pagamento, não porque alguém
// apagou a dívida.
fiadoRouter.post("/baixas", assincrono(async (req, res) => {
  const parse = baixaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const ids = [...new Set(parse.data.movimentacaoIds)];
  const usuarioId = req.usuario!.usuarioId;

  const vendas = await prisma.movimentacao.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      tipo: true,
      motivo: true,
      formaPagamento: true,
      cliente: true,
      pagamentoFiado: { select: { id: true } },
      estorno: { select: { id: true } },
    },
  });

  if (vendas.length !== ids.length) {
    throw new ErroHttp(404, "Uma das vendas não existe mais.");
  }

  for (const venda of vendas) {
    if (venda.formaPagamento !== "fiado" || venda.tipo !== "saida" || venda.motivo !== "venda") {
      throw new ErroHttp(422, "Só venda fiado pode receber baixa.");
    }
    if (venda.estorno) {
      throw new ErroHttp(422, "Esta venda foi desfeita e não é mais uma dívida.");
    }
    // Dois aparelhos podem estar na tela de devedores ao mesmo tempo. Além
    // desta checagem, o @unique da tabela é quem garante de verdade.
    if (venda.pagamentoFiado) {
      throw new ErroHttp(409, "Esta dívida já foi baixada por outra pessoa.");
    }
    if (!venda.cliente?.trim()) {
      throw new ErroHttp(422, "Esta venda fiado está sem o nome do devedor.");
    }
  }

  const pagamentos = await prisma.$transaction(
    vendas.map((venda) =>
      prisma.pagamentoFiado.create({
        data: {
          movimentacaoId: venda.id,
          usuarioId,
          // O nome vai copiado: o recibo precisa dizer de quem era a dívida
          // mesmo que a venda seja consultada por outro caminho depois.
          cliente: venda.cliente!.trim(),
        },
      }),
    ),
  );

  res.status(201).json({ baixadas: pagamentos.length });
}));

// Auditoria: quem deu baixa em quê, e quando. É a resposta para "eu já paguei
// isso" — e o motivo de a baixa ser um registro, e não um campo.
fiadoRouter.get("/baixas", assincrono(async (_req, res) => {
  const pagamentos = await prisma.pagamentoFiado.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
    select: {
      id: true,
      cliente: true,
      criadoEm: true,
      usuario: { select: { nome: true } },
      movimentacao: {
        select: {
          id: true,
          valor: true,
          criadoEm: true,
          produto: { select: { nome: true } },
        },
      },
    },
  });

  res.json(
    pagamentos.map((p) => ({
      id: p.id,
      cliente: p.cliente,
      criadoEm: p.criadoEm.toISOString(),
      baixadaPor: p.usuario.nome,
      valor: Number(p.movimentacao.valor),
      produtoNome: p.movimentacao.produto.nome,
      vendaEm: p.movimentacao.criadoEm.toISOString(),
    })),
  );
}));
