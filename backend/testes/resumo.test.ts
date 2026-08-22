// Classificação das movimentações no resumo de conferência de caixa.
// A função é pura (não toca no banco) justamente para poder ser testada aqui.
import test from "node:test";
import assert from "node:assert/strict";

import { grupoDoMotivo } from "../src/lib/gruposDeMovimentacao";
import { MOTIVOS_MOVIMENTACAO, MOTIVOS_POR_TIPO, TIPOS_MOVIMENTACAO } from "../src/lib/enums";

test("venda entra em vendas e compra entra em compras", () => {
  assert.equal(grupoDoMotivo("saida", "venda"), "vendas");
  assert.equal(grupoDoMotivo("entrada", "compra"), "compras");
});

test("devolução não é venda, mesmo mexendo no estoque", () => {
  // Devolução é entrada; contá-la como compra inflaria o total gasto no dia.
  assert.equal(grupoDoMotivo("entrada", "devolucao"), "outras");
});

test("perda, uso interno e inventário ficam visíveis em 'outras'", () => {
  // Somar perda dentro de "vendas" faria o dia parecer melhor do que foi.
  assert.equal(grupoDoMotivo("saida", "perda"), "outras");
  assert.equal(grupoDoMotivo("saida", "uso_interno"), "outras");
  assert.equal(grupoDoMotivo("saida", "inventario"), "outras");
  assert.equal(grupoDoMotivo("entrada", "inventario"), "outras");
});

test("estorno aparece separado, nunca somado ao movimento comercial", () => {
  assert.equal(grupoDoMotivo("entrada", "estorno"), "outras");
  assert.equal(grupoDoMotivo("saida", "estorno"), "outras");
});

test("toda combinação válida de tipo e motivo cai em algum grupo", () => {
  // Guarda contra o motivo novo que alguém adiciona em enums.ts e esquece de
  // classificar aqui: sem esta checagem, ele sumiria do resumo em silêncio.
  const grupos = new Set(["vendas", "compras", "outras"]);

  for (const tipo of TIPOS_MOVIMENTACAO) {
    const motivos = [...MOTIVOS_POR_TIPO[tipo], "estorno" as const];
    for (const motivo of motivos) {
      assert.ok(grupos.has(grupoDoMotivo(tipo, motivo)), `${tipo}/${motivo} sem grupo`);
    }
  }

  // E que nenhum motivo declarado tenha ficado de fora das listas acima.
  const cobertos = new Set([...MOTIVOS_POR_TIPO.entrada, ...MOTIVOS_POR_TIPO.saida, "estorno"]);
  for (const motivo of MOTIVOS_MOVIMENTACAO) {
    assert.ok(cobertos.has(motivo), `motivo "${motivo}" não é exercitado por este teste`);
  }
});
