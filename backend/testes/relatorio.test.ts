// Agregação do relatório de movimentação por produto. A função é pura
// (src/lib/agregacaoMovimentacao.ts), então dá para conferir a conta sem
// banco, com números escolhidos à mão.
import test from "node:test";
import assert from "node:assert/strict";

import {
  montarRelatorioPorProduto,
  type LinhaAgrupada,
} from "../src/lib/agregacaoMovimentacao";

const PRODUTOS = [
  { id: "prod-1", nome: "Ração 20kg", unidade: "kg" },
  { id: "prod-2", nome: "Milho a granel", unidade: "kg" },
];

function linha(dados: Partial<LinhaAgrupada> = {}): LinhaAgrupada {
  return {
    produtoId: "prod-1",
    tipo: "entrada",
    motivo: "compra",
    quantidade: 10,
    valor: 100,
    movimentacoes: 1,
    ...dados,
  };
}

test("separa o que entrou do que saiu", () => {
  // O relatório antigo devolvia só "20 movimentados" para este caso — que não
  // é nem o que entrou, nem o que saiu, nem o que sobrou.
  const [resultado] = montarRelatorioPorProduto(
    [
      linha({ tipo: "entrada", motivo: "compra", quantidade: 10 }),
      linha({ tipo: "saida", motivo: "venda", quantidade: 10 }),
    ],
    PRODUTOS,
  );

  assert.equal(resultado.entradas.quantidade, 10);
  assert.equal(resultado.saidas.quantidade, 10);
  assert.equal(resultado.totalMovimentado, 20);
  assert.equal(resultado.saldo, 0);
});

test("o saldo mostra se o produto encheu ou esvaziou no período", () => {
  const [resultado] = montarRelatorioPorProduto(
    [
      linha({ tipo: "entrada", quantidade: 50 }),
      linha({ tipo: "saida", motivo: "venda", quantidade: 12 }),
    ],
    PRODUTOS,
  );

  assert.equal(resultado.saldo, 38);
});

test("a quebra por motivo mantém cada motivo separado", () => {
  const [resultado] = montarRelatorioPorProduto(
    [
      linha({ tipo: "saida", motivo: "venda", quantidade: 8, movimentacoes: 4 }),
      linha({ tipo: "saida", motivo: "perda", quantidade: 2, movimentacoes: 1 }),
    ],
    PRODUTOS,
  );

  const motivos = resultado.porMotivo.map((m) => m.motivo);
  assert.deepEqual(motivos, ["venda", "perda"]);
  assert.equal(resultado.saidas.movimentacoes, 5);
});

test("a ordem dos motivos não depende da ordem que o banco devolveu", () => {
  // Um relatório que troca a ordem das linhas a cada consulta é impossível de
  // comparar com o da semana passada.
  const umaOrdem = montarRelatorioPorProduto(
    [
      linha({ tipo: "saida", motivo: "perda", quantidade: 2 }),
      linha({ tipo: "saida", motivo: "venda", quantidade: 8 }),
    ],
    PRODUTOS,
  );
  const outraOrdem = montarRelatorioPorProduto(
    [
      linha({ tipo: "saida", motivo: "venda", quantidade: 8 }),
      linha({ tipo: "saida", motivo: "perda", quantidade: 2 }),
    ],
    PRODUTOS,
  );

  assert.deepEqual(
    umaOrdem[0].porMotivo.map((m) => m.motivo),
    outraOrdem[0].porMotivo.map((m) => m.motivo),
  );
});

test("produtos vêm do que mais movimentou para o que menos movimentou", () => {
  const resultado = montarRelatorioPorProduto(
    [
      linha({ produtoId: "prod-1", quantidade: 5 }),
      linha({ produtoId: "prod-2", quantidade: 40 }),
    ],
    PRODUTOS,
  );

  assert.deepEqual(
    resultado.map((r) => r.produtoNome),
    ["Milho a granel", "Ração 20kg"],
  );
});

test("movimentação de produto que saiu do catálogo continua contando", () => {
  // A movimentação é registro de auditoria e não some junto com o produto.
  const [resultado] = montarRelatorioPorProduto([linha({ produtoId: "prod-sumido" })], PRODUTOS);

  assert.equal(resultado.produtoNome, "(produto removido)");
  assert.equal(resultado.totalMovimentado, 10);
});
