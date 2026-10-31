// O que conta como anomalia num lançamento já gravado. A regra é pura
// (src/lib/anomalias.ts), então roda sem banco e sem servidor.
//
// Este módulo NÃO recusa nada — ver a decisão em docs/ARCHITECTURE.md. Quem
// barra é a tela; aqui é só o contador do Resumo do Dia.
import test from "node:test";
import assert from "node:assert/strict";

import { anomaliasDe, exigeValor, fracaoEmUnidadeContavel } from "../src/lib/anomalias";

const base = { motivo: "venda" as const, quantidade: 2, valor: 50, unidade: "kg" };

test("venda sem valor é anomalia", () => {
  // O estoque baixa, o caixa não fecha, e olhando só o histórico ninguém
  // descobre por quê.
  assert.deepEqual(anomaliasDe({ ...base, valor: 0 }), ["valor_zerado"]);
});

test("perda, uso interno e ajuste não precisam de valor", () => {
  // Elas mexem só no estoque: exigir dinheiro delas é que seria o erro.
  for (const motivo of ["perda", "uso_interno", "inventario"] as const) {
    assert.equal(exigeValor(motivo), false);
    assert.deepEqual(anomaliasDe({ ...base, motivo, valor: 0 }), []);
  }
});

test("compra e devolução também exigem valor", () => {
  assert.deepEqual(anomaliasDe({ ...base, motivo: "compra", valor: 0 }), ["valor_zerado"]);
  assert.deepEqual(anomaliasDe({ ...base, motivo: "devolucao", valor: 0 }), ["valor_zerado"]);
});

test("quantidade acima de mil é anomalia", () => {
  assert.ok(anomaliasDe({ ...base, quantidade: 1001 }).includes("quantidade_alta"));
  assert.ok(!anomaliasDe({ ...base, quantidade: 1000 }).includes("quantidade_alta"));
});

test("valor muito alto é anomalia", () => {
  assert.ok(anomaliasDe({ ...base, valor: 5001 }).includes("valor_alto"));
  assert.ok(!anomaliasDe({ ...base, valor: 5000 }).includes("valor_alto"));
});

test("quantidade quebrada em produto contado por unidade é anomalia", () => {
  // Meia vassoura não sai da prateleira. Quase sempre é a vírgula do preço
  // digitada no campo da quantidade.
  assert.ok(fracaoEmUnidadeContavel("un", 2.5));
  assert.ok(anomaliasDe({ ...base, unidade: "un", quantidade: 2.5 }).includes("fracao_contavel"));
});

test("quantidade quebrada em kg e em litro é normal", () => {
  // Meio quilo de ração é uma venda comum. A regra só vale para o que se conta.
  assert.ok(!fracaoEmUnidadeContavel("kg", 2.5));
  assert.deepEqual(anomaliasDe({ ...base, unidade: "kg", quantidade: 2.5 }), []);
  assert.deepEqual(anomaliasDe({ ...base, unidade: "L", quantidade: 0.75 }), []);
});

test("unidade desconhecida não vira anomalia", () => {
  // Produto apagado ou vindo de uma versão antiga não pode fazer o relatório
  // do dia apontar erro onde não há.
  assert.ok(!fracaoEmUnidadeContavel(undefined, 2.5));
});

test("um lançamento pode ter mais de uma anomalia ao mesmo tempo", () => {
  const achadas = anomaliasDe({ motivo: "venda", quantidade: 1500.5, valor: 0, unidade: "un" });

  assert.deepEqual(achadas.sort(), ["fracao_contavel", "quantidade_alta", "valor_zerado"]);
});

test("lançamento normal não gera nada", () => {
  assert.deepEqual(anomaliasDe(base), []);
});
