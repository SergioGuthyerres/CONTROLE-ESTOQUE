// Quando um produto pode ser apagado e quando só pode ser arquivado.
// A regra é pura (src/lib/arquivamentoProduto.ts), então roda sem banco.
import test from "node:test";
import assert from "node:assert/strict";

import {
  acaoParaRemover,
  avisoDaRemocao,
  garantirQuePodeExcluir,
} from "../src/lib/arquivamentoProduto";

test("produto que nunca foi movimentado é apagado de verdade", () => {
  // É o caso real do pedido: duplicata digitada errada, cadastro de teste.
  // Não há histórico para preservar, então preservar não faz sentido.
  assert.equal(acaoParaRemover({ movimentacoes: 0 }), "excluir");
});

test("produto com qualquer histórico é arquivado, não apagado", () => {
  assert.equal(acaoParaRemover({ movimentacoes: 1 }), "arquivar");
  assert.equal(acaoParaRemover({ movimentacoes: 500 }), "arquivar");
});

test("o servidor recusa apagar produto com histórico", () => {
  // A tela já pergunta antes, mas a tela é só a primeira linha: quem chama a
  // API direto também não apaga histórico.
  assert.throws(() => garantirQuePodeExcluir({ movimentacoes: 3 }), { status: 409 });
});

test("a recusa diz quantos registros existem e o que fazer", () => {
  // Erro que só diz "não pode" manda a pessoa adivinhar. Este diz o número e
  // aponta a saída.
  try {
    garantirQuePodeExcluir({ movimentacoes: 5 });
    assert.fail("deveria ter recusado");
  } catch (erro) {
    const mensagem = (erro as Error).message;
    assert.match(mensagem, /5 movimentações/);
    assert.match(mensagem, /[Aa]rquive/);
  }
});

test("apagar produto sem histórico não é barrado", () => {
  assert.doesNotThrow(() => garantirQuePodeExcluir({ movimentacoes: 0 }));
});

test("o aviso avisa que nada de estoque é afetado quando não há histórico", () => {
  const aviso = avisoDaRemocao("Vassoura", { movimentacoes: 0 });

  assert.match(aviso, /Vassoura/);
  assert.match(aviso, /não afeta nenhum registro/);
});

test("o aviso mostra a contagem real e promete preservar o histórico", () => {
  const aviso = avisoDaRemocao("Ração 25kg", { movimentacoes: 12 });

  assert.match(aviso, /12 registros/);
  assert.match(aviso, /arquivado/);
  assert.match(aviso, /continuam/);
});

test("o aviso fala no singular quando é um registro só", () => {
  // "1 registros de estoque" num aviso de operação destrutiva é o tipo de
  // detalhe que faz a pessoa desconfiar do sistema na hora errada.
  const aviso = avisoDaRemocao("Cabo de enxada", { movimentacoes: 1 });

  assert.match(aviso, /1 registro de estoque/);
  assert.doesNotMatch(aviso, /1 registros/);
});
