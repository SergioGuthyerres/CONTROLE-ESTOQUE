import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { exigirAutenticacao } from "../middleware/auth";
import { assincrono } from "../middleware/erros";
import { ErroHttp } from "../lib/erroHttp";
import {
  alocarPagamento,
  chaveDoCliente,
  listarDevedores,
  totalEmAberto,
  type VendaFiado,
} from "../lib/fiado";

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
      pagamentosFiado: { select: { valor: true } },
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
    pago: v.pagamentosFiado.reduce((soma, p) => soma + Number(p.valor), 0),
    estorno: v.estorno,
  }));

  const devedores = listarDevedores(paraRegra);
  const total = devedores.reduce((soma, d) => soma + d.total, 0);

  res.json({ devedores, total });
}));

// Um pagamento é um valor entregue por uma pessoa, não uma dívida quitada.
//
// É a diferença entre o sistema e o caderno que ele substitui: no caderno o
// freguês aparece e deixa o que tem. A rota recebe quanto ele pagou e espalha
// pelas dívidas dele, da mais antiga para a mais nova (ver alocarPagamento em
// lib/fiado.ts). Quem paga tudo é só o caso em que o valor bate com o total.
const pagamentoSchema = z.object({
  cliente: z.string().trim().min(2).max(80),
  valor: z.number().positive().finite().max(1_000_000),
});

fiadoRouter.post("/pagamentos", assincrono(async (req, res) => {
  const parse = pagamentoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const { cliente, valor } = parse.data;
  const usuarioId = req.usuario!.usuarioId;
  const chave = chaveDoCliente(cliente);

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
      pagamentosFiado: { select: { valor: true } },
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
    pago: v.pagamentosFiado.reduce((soma, p) => soma + Number(p.valor), 0),
    estorno: v.estorno,
  }));

  // Só as dívidas DESTA pessoa, pela mesma chave normalizada que agrupa a
  // lista de devedores — senão "Seu Antônio" pagaria e "seu antonio"
  // continuaria devendo.
  const devedor = listarDevedores(paraRegra).find((d) => chaveDoCliente(d.cliente) === chave);
  if (!devedor) {
    throw new ErroHttp(404, `${cliente} não tem nenhuma dívida em aberto.`);
  }

  const emAberto = totalEmAberto(devedor.dividas);
  if (valor > emAberto) {
    // Receber mais do que a pessoa deve é um número digitado errado virando
    // crédito invisível: não existe lugar no modelo para "a loja deve ao
    // freguês", então o excedente simplesmente sumiria.
    throw new ErroHttp(
      422,
      `${devedor.cliente} deve ${emAberto.toFixed(2)} e o pagamento é de ${valor.toFixed(2)}. Confira o valor.`,
    );
  }

  const parcelas = alocarPagamento(devedor.dividas, valor);

  const criados = await prisma.$transaction(
    parcelas.map((parcela) =>
      prisma.pagamentoFiado.create({
        data: {
          movimentacaoId: parcela.movimentacaoId,
          usuarioId,
          // O nome vai copiado: o recibo precisa dizer de quem era a dívida
          // mesmo que a venda seja consultada por outro caminho depois.
          cliente: devedor.cliente,
          valor: parcela.valor,
        },
      }),
    ),
  );

  res.status(201).json({
    cliente: devedor.cliente,
    pago: valor,
    restante: Math.round((emAberto - valor) * 100) / 100,
    dividasAfetadas: criados.length,
  });
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
      valor: true,
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
      valor: Number(p.valor),
      valorDaVenda: Number(p.movimentacao.valor),
      produtoNome: p.movimentacao.produto.nome,
      vendaEm: p.movimentacao.criadoEm.toISOString(),
    })),
  );
}));
