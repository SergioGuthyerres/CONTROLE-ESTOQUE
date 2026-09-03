// Regras de entrada da venda fiado. O schema é puro
// (src/lib/movimentacaoSchema.ts), então dá para exercitá-lo sem servidor,
// sem banco e sem token.
import test from "node:test";
import assert from "node:assert/strict";

import { movimentacaoSchema } from "../src/lib/movimentacaoSchema";

function venda(extra: Record<string, unknown> = {}) {
  return {
    id: "0f8b6d1e-9f4a-4c3b-8a5e-2b1c7d9e4f60",
    produtoId: "prod-1",
    tipo: "saida",
    motivo: "venda",
    quantidade: 3,
    valor: 45,
    origemDispositivo: "aparelho-1",
    criadoEm: new Date().toISOString(),
    ...extra,
  };
}

test("venda à vista não precisa de cliente", () => {
  const parse = movimentacaoSchema.safeParse(venda({ formaPagamento: "a_vista" }));
  assert.ok(parse.success);
});

test("venda fiado sem nome é recusada", () => {
  // Fiado sem nome é dívida que ninguém consegue cobrar — e a lista de
  // devedores não teria o que mostrar. Exigir na entrada evita descobrir isso
  // só no dia da cobrança.
  const parse = movimentacaoSchema.safeParse(venda({ formaPagamento: "fiado" }));

  assert.ok(!parse.success);
  assert.match(JSON.stringify(parse.error.flatten()), /nome de quem levou/);
});

test("venda fiado com nome é aceita", () => {
  const parse = movimentacaoSchema.safeParse(
    venda({ formaPagamento: "fiado", cliente: "Seu Antônio da esquina" }),
  );
  assert.ok(parse.success);
});

test("nome de cliente numa venda à vista é recusado", () => {
  // Quase sempre é alguém que quis marcar fiado e esqueceu de trocar a forma.
  // Gravar assim criaria uma dívida invisível: o nome ficaria no banco e a
  // pessoa nunca apareceria na lista de devedores.
  const parse = movimentacaoSchema.safeParse(
    venda({ formaPagamento: "a_vista", cliente: "Seu Antônio" }),
  );

  assert.ok(!parse.success);
});

test("forma de pagamento não se aplica a perda", () => {
  const parse = movimentacaoSchema.safeParse(
    venda({ motivo: "perda", formaPagamento: "a_vista" }),
  );

  assert.ok(!parse.success);
  assert.match(JSON.stringify(parse.error.flatten()), /só se aplica a venda/);
});

test("forma de pagamento não se aplica a compra", () => {
  const parse = movimentacaoSchema.safeParse(
    venda({ tipo: "entrada", motivo: "compra", formaPagamento: "fiado", cliente: "Alguém" }),
  );

  assert.ok(!parse.success);
});

test("venda de um PWA antigo, sem forma de pagamento, continua sendo aceita", () => {
  // O app se publica sozinho a cada merge e a API é atualizada pelo CI, mas o
  // celular pode estar com uma versão em cache e uma fila offline gravada
  // antes desta funcionalidade. Recusar esse lote perderia venda registrada.
  const parse = movimentacaoSchema.safeParse(venda());

  assert.ok(parse.success);
  assert.equal(parse.data.formaPagamento, undefined);
});

test("cliente com espaço em volta é aparado", () => {
  // O nome digitado no balcão vem com espaço sobrando, e ele é a chave que
  // junta as dívidas da mesma pessoa na lista de devedores.
  const parse = movimentacaoSchema.safeParse(
    venda({ formaPagamento: "fiado", cliente: "  Dona Rita  " }),
  );

  assert.ok(parse.success);
  assert.equal(parse.data.cliente, "Dona Rita");
});

test("nome de uma letra só é recusado", () => {
  const parse = movimentacaoSchema.safeParse(
    venda({ formaPagamento: "fiado", cliente: "R" }),
  );

  assert.ok(!parse.success);
});
