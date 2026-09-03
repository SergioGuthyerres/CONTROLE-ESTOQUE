// A sugestão de nome é o que segura a lista de devedores em pé: se o mesmo
// freguês entra escrito de três jeitos, a dívida dele aparece repartida em
// três e ninguém cobra o valor certo.
import { beforeEach, expect, test } from "vitest";

import { db, type MovimentacaoLocal } from "../src/db/db";
import { clientesJaUsados } from "../src/lib/clientes";

let contador = 0;

function venda(extra: Partial<MovimentacaoLocal> = {}): MovimentacaoLocal {
  contador += 1;
  return {
    id: `mov-${contador}`,
    produtoId: "prod-1",
    tipo: "saida",
    motivo: "venda",
    quantidade: 1,
    valor: 10,
    origemDispositivo: "aparelho-1",
    criadoEm: new Date(2026, 7, 21, 10, contador).toISOString(),
    sincronizada: 0,
    ...extra,
  } as MovimentacaoLocal;
}

beforeEach(async () => {
  contador = 0;
  await db.movimentacoes.clear();
});

test("sem venda fiado, não sugere nada", async () => {
  await db.movimentacoes.bulkPut([venda({ formaPagamento: "a_vista" })]);

  expect(await clientesJaUsados()).toEqual([]);
});

test("lista só quem levou fiado", async () => {
  await db.movimentacoes.bulkPut([
    venda({ formaPagamento: "fiado", cliente: "Dona Rita" }),
    venda({ formaPagamento: "a_vista" }),
    venda({ motivo: "perda" }),
  ]);

  expect(await clientesJaUsados()).toEqual(["Dona Rita"]);
});

test("o mesmo freguês aparece uma vez só, por mais que ele leve fiado", async () => {
  await db.movimentacoes.bulkPut([
    venda({ formaPagamento: "fiado", cliente: "Seu Antônio" }),
    venda({ formaPagamento: "fiado", cliente: "Seu Antônio" }),
    venda({ formaPagamento: "fiado", cliente: "  Seu Antônio  " }),
  ]);

  expect(await clientesJaUsados()).toEqual(["Seu Antônio"]);
});

test("os nomes vêm em ordem alfabética de português", async () => {
  // localeCompare e não sort() cru: com a ordem de code point, "Ângela" cai
  // depois de "Zeca" e some do fim da lista de quem procura por "A".
  await db.movimentacoes.bulkPut([
    venda({ formaPagamento: "fiado", cliente: "Zeca" }),
    venda({ formaPagamento: "fiado", cliente: "Ângela" }),
    venda({ formaPagamento: "fiado", cliente: "Bruno" }),
  ]);

  expect(await clientesJaUsados()).toEqual(["Ângela", "Bruno", "Zeca"]);
});
