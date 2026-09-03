// Regras do "desfazer" do histórico. São puras de propósito
// (src/services/estornoService.ts não toca no banco), então este arquivo
// testa a regra de negócio direto, sem servidor e sem Prisma.
import test from "node:test";
import assert from "node:assert/strict";

import {
  dadosDoEstorno,
  garantirQuePodeEstornar,
  ORIGEM_ESTORNO,
  type MovimentacaoParaEstornar,
} from "../src/services/estornoService";
import { MOTIVOS_POR_TIPO } from "../src/lib/enums";

function venda(extra: Partial<MovimentacaoParaEstornar> = {}): MovimentacaoParaEstornar {
  return {
    id: "mov-1",
    tipo: "saida",
    motivo: "venda",
    quantidade: 3,
    valor: 45,
    produtoId: "prod-1",
    estorno: null,
    ...extra,
  };
}

test("o estorno de uma saída é uma entrada da mesma quantidade", () => {
  const estorno = dadosDoEstorno(venda(), "id-admin");

  assert.equal(estorno.tipo, "entrada");
  assert.equal(estorno.quantidade, 3);
  assert.equal(estorno.estornoDeId, "mov-1");
});

test("o estorno de uma entrada é uma saída da mesma quantidade", () => {
  const compra = venda({ id: "mov-2", tipo: "entrada", motivo: "compra", quantidade: 50, valor: 200 });
  const estorno = dadosDoEstorno(compra, "id-admin");

  assert.equal(estorno.tipo, "saida");
  assert.equal(estorno.quantidade, 50);
});

test("o valor acompanha o estorno", () => {
  // Sem isto, desfazer uma compra de R$ 200 deixaria os R$ 200 no custo médio
  // e o valor total em estoque (RF12) continuaria contando dinheiro que a
  // dona não gastou.
  const estorno = dadosDoEstorno(venda({ valor: 45 }), "id-admin");
  assert.equal(estorno.valor, 45);
});

test("o autor do estorno é quem desfez, não quem lançou", () => {
  // O dado útil na auditoria é quem mandou desfazer. Quem lançou continua
  // registrado na movimentação original, que não é tocada.
  const estorno = dadosDoEstorno(venda(), "id-admin");
  assert.equal(estorno.usuarioId, "id-admin");
});

test("o estorno não finge ter vindo de um aparelho", () => {
  const estorno = dadosDoEstorno(venda(), "id-admin");
  assert.equal(estorno.origemDispositivo, ORIGEM_ESTORNO);
});

test("movimentação já desfeita não pode ser desfeita de novo", () => {
  // Dois cliques no botão criariam dois inversos e o estoque erraria para o
  // outro lado. O índice único em estornoDeId cobre a corrida; esta checagem
  // é o que devolve uma mensagem em vez de um erro de banco.
  const jaEstornada = venda({ estorno: { id: "mov-99" } });

  assert.throws(() => garantirQuePodeEstornar(jaEstornada), { status: 409 });
});

test("venda fiado já paga não pode ser desfeita", () => {
  // Desfazer apagaria a venda e deixaria o pagamento pendurado: a loja
  // ficaria com um recibo de um dinheiro que entrou por uma venda que o
  // sistema diz que nunca existiu.
  const paga = venda({
    formaPagamento: "fiado",
    cliente: "Dona Rita",
    pagamentoFiado: { id: "pag-1" },
  } as never);

  assert.throws(() => garantirQuePodeEstornar(paga), { status: 422 });
});

test("estorno de estorno é recusado", () => {
  // Deixar estornar um estorno vira um pêndulo sem fim no histórico, e o
  // caminho honesto para refazer a movimentação é registrá-la de novo.
  const estorno = venda({ id: "mov-3", motivo: "estorno", tipo: "entrada" });

  assert.throws(() => garantirQuePodeEstornar(estorno), { status: 422 });
});

test("o motivo 'estorno' não é oferecido a quem lança movimentação na tela", () => {
  // MOTIVOS_POR_TIPO é a lista do que um humano escolhe — e é ela que o zod da
  // rota de sincronização usa. Se "estorno" entrasse aqui, um cliente
  // adulterado poderia plantar um estorno solto, sem original ligado a ele.
  assert.ok(!MOTIVOS_POR_TIPO.entrada.includes("estorno"));
  assert.ok(!MOTIVOS_POR_TIPO.saida.includes("estorno"));
});
