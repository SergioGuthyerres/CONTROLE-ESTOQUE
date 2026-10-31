// A lista de devedores é a regra que decide quem a loja vai cobrar. Ela é
// pura (src/lib/fiado.ts), então dá para exercitar sem banco nem servidor.
import test from "node:test";
import assert from "node:assert/strict";

import {
  alocarPagamento,
  chaveDoCliente,
  listarDevedores,
  saldoDaDivida,
  totalEmAberto,
  type VendaFiado,
} from "../src/lib/fiado";

let contador = 0;

function venda(extra: Partial<VendaFiado> = {}): VendaFiado {
  contador += 1;
  return {
    id: `mov-${contador}`,
    cliente: "Dona Rita",
    valor: 30,
    criadoEm: `2026-08-${String(contador).padStart(2, "0")}T12:00:00.000Z`,
    produtoNome: "Ração 25kg",
    quantidade: 1,
    unidade: "un",
    vendidoPor: "Funcionário",
    pago: 0,
    estorno: null,
    ...extra,
  };
}

test("venda fiado sem baixa vira dívida", () => {
  const devedores = listarDevedores([venda({ valor: 45 })]);

  assert.equal(devedores.length, 1);
  assert.equal(devedores[0].cliente, "Dona Rita");
  assert.equal(devedores[0].total, 45);
  assert.equal(devedores[0].dividas.length, 1);
});

test("venda totalmente paga sai da lista", () => {
  // É isso que faz o devedor sumir da pilha: a soma dos pagamentos cobriu a
  // venda, e não uma dívida apagada.
  const devedores = listarDevedores([venda({ valor: 45, pago: 45 })]);

  assert.deepEqual(devedores, []);
});

test("venda paga pela metade continua na lista, só pelo que falta", () => {
  // É o caderno de fiado: o freguês apareceu e deixou o que tinha.
  const devedores = listarDevedores([venda({ valor: 100, pago: 40 })]);

  assert.equal(devedores.length, 1);
  assert.equal(devedores[0].total, 60);
  assert.equal(devedores[0].dividas[0].saldo, 60);
  assert.equal(devedores[0].dividas[0].pago, 40);
});

test("venda desfeita não é dívida", () => {
  // A mercadoria voltou para a prateleira. Cobrar por ela seria cobrar o
  // freguês por um erro da loja.
  const devedores = listarDevedores([venda({ estorno: { id: "est-1" } })]);

  assert.deepEqual(devedores, []);
});

test("dívidas do mesmo freguês somam num devedor só", () => {
  const devedores = listarDevedores([venda({ valor: 30 }), venda({ valor: 20 })]);

  assert.equal(devedores.length, 1);
  assert.equal(devedores[0].total, 50);
  assert.equal(devedores[0].dividas.length, 2);
});

test("o mesmo nome escrito de outro jeito não vira um segundo devedor", () => {
  // "Antonio", "Antônio" e "seu antonio" são a mesma pessoa. Se virassem três
  // devedores de R$ 30, ninguém cobraria os R$ 90 que ele deve.
  const devedores = listarDevedores([
    venda({ cliente: "Seu Antônio", valor: 30 }),
    venda({ cliente: "seu antonio", valor: 30 }),
    venda({ cliente: "  SEU ANTONIO  ", valor: 30 }),
  ]);

  assert.equal(devedores.length, 1);
  assert.equal(devedores[0].total, 90);
});

test("o nome exibido é a grafia da compra mais recente", () => {
  const devedores = listarDevedores([
    venda({ cliente: "seu antonio", criadoEm: "2026-08-01T12:00:00.000Z" }),
    venda({ cliente: "Seu Antônio", criadoEm: "2026-08-10T12:00:00.000Z" }),
  ]);

  assert.equal(devedores[0].cliente, "Seu Antônio");
});

test("quem deve há mais tempo aparece primeiro", () => {
  // Ordenar por valor jogaria a dívida grande e recente na frente da pequena
  // e esquecida — e é a esquecida que vira prejuízo.
  const devedores = listarDevedores([
    venda({ cliente: "Recente", valor: 500, criadoEm: "2026-08-20T12:00:00.000Z" }),
    venda({ cliente: "Antiga", valor: 10, criadoEm: "2026-02-03T12:00:00.000Z" }),
  ]);

  assert.deepEqual(
    devedores.map((d) => d.cliente),
    ["Antiga", "Recente"],
  );
});

test("dentro do devedor, a dívida mais antiga vem primeiro", () => {
  const devedores = listarDevedores([
    venda({ criadoEm: "2026-08-20T12:00:00.000Z", produtoNome: "Nova" }),
    venda({ criadoEm: "2026-08-01T12:00:00.000Z", produtoNome: "Velha" }),
  ]);

  assert.deepEqual(
    devedores[0].dividas.map((d) => d.produtoNome),
    ["Velha", "Nova"],
  );
  assert.equal(devedores[0].desde, "2026-08-01T12:00:00.000Z");
});

test("venda fiado sem nome não trava a lista", () => {
  // A validação de entrada já exige o nome, mas o banco tem vendas anteriores
  // a ela. Uma linha sem nome não pode derrubar a lista de todo mundo.
  const devedores = listarDevedores([venda({ cliente: null }), venda({ cliente: "   " })]);

  assert.deepEqual(devedores, []);
});

test("chaveDoCliente ignora acento, caixa e espaço repetido", () => {
  assert.equal(chaveDoCliente("  Seu   ANTÔNIO "), "seu antonio");
});

test("o pagamento vai para a dívida mais antiga primeiro", () => {
  // É a ordem em que se cobra e a ordem do caderno: quem paga R$ 50 está
  // pagando o que deve há mais tempo, não a compra de ontem.
  const dividas = listarDevedores([
    venda({ valor: 30, criadoEm: "2026-08-01T12:00:00.000Z" }),
    venda({ valor: 70, criadoEm: "2026-09-01T12:00:00.000Z" }),
  ])[0].dividas;

  const parcelas = alocarPagamento(dividas, 50);

  assert.equal(parcelas.length, 2);
  assert.equal(parcelas[0].valor, 30); // a antiga, quitada
  assert.equal(parcelas[1].valor, 20); // a nova, pela metade
});

test("pagamento menor que a dívida mais antiga gera uma parcela só", () => {
  const dividas = listarDevedores([venda({ valor: 100 })])[0].dividas;
  const parcelas = alocarPagamento(dividas, 25);

  assert.equal(parcelas.length, 1);
  assert.equal(parcelas[0].movimentacaoId, dividas[0].movimentacaoId);
  assert.equal(parcelas[0].valor, 25);
});

test("pagar o total aloca tudo e não sobra nada", () => {
  const dividas = listarDevedores([
    venda({ valor: 30 }),
    venda({ valor: 70 }),
  ])[0].dividas;

  const parcelas = alocarPagamento(dividas, 100);

  assert.equal(totalEmAberto(dividas), 100);
  assert.equal(parcelas.reduce((s, p) => s + p.valor, 0), 100);
});

test("centavos não deixam dívida quitada presa na lista", () => {
  // Decimal do Prisma convertido para número deixa resto de 0,0000001, e sem
  // arredondar ao centavo a dívida ficaria para sempre devendo um nada.
  const v = venda({ valor: 33.33, pago: 33.329999999 });

  assert.equal(saldoDaDivida(v), 0);
  assert.deepEqual(listarDevedores([v]), []);
});
