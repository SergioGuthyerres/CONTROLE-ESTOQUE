// As travas da tela de lançamento: o que não entra de jeito nenhum e o que
// entra depois de alguém confirmar. A regra é pura (src/lib/anomalias.ts).
import { describe, expect, test } from "vitest";

import {
  bloqueios,
  confirmacoes,
  conferir,
  repetidaRecente,
  type Lancamento,
} from "../src/lib/anomalias";

const venda = (extra: Partial<Lancamento> = {}): Lancamento => ({
  tipo: "saida",
  motivo: "venda",
  quantidade: 2,
  valor: 50,
  unidade: "kg",
  produtoNome: "Milho em grão",
  estoqueConhecido: 100,
  ...extra,
});

const codigos = (l: Lancamento, agora?: number) => conferir(l, agora).map((a) => a.codigo);

describe("bloqueios", () => {
  test("venda com valor zero não entra, e a mensagem manda trocar o motivo", () => {
    // Mandar inventar um número seria pior: saída sem dinheiro existe, só não
    // se chama venda.
    const travas = bloqueios(conferir(venda({ valor: 0 })));

    expect(travas).toHaveLength(1);
    expect(travas[0].codigo).toBe("valor_zerado");
    expect(travas[0].mensagem).toMatch(/perda, uso interno ou ajuste de inventário/);
  });

  test("perda, uso interno e ajuste passam com valor zero", () => {
    for (const motivo of ["perda", "uso_interno", "inventario"] as const) {
      expect(codigos(venda({ motivo, valor: 0 }))).toEqual([]);
    }
  });

  test("compra com valor zero também não entra", () => {
    const travas = bloqueios(conferir(venda({ tipo: "entrada", motivo: "compra", valor: 0 })));

    expect(travas[0].codigo).toBe("valor_zerado");
    expect(travas[0].mensagem).toMatch(/ajuste de inventário/);
  });

  test("meia unidade de produto contável não entra", () => {
    const travas = bloqueios(conferir(venda({ unidade: "un", quantidade: 2.5 })));

    expect(travas[0].codigo).toBe("fracao_contavel");
    // A mensagem aponta a causa provável, que é o preço digitado no campo
    // errado — é o que resolve, em vez de só dizer "inválido".
    expect(travas[0].mensagem).toMatch(/campo da quantidade/);
  });

  test("meio quilo é venda comum", () => {
    expect(codigos(venda({ unidade: "kg", quantidade: 0.5 }))).toEqual([]);
  });
});

describe("confirmações", () => {
  test("quantidade acima de mil pede confirmação, não bloqueia", () => {
    const achadas = conferir(venda({ quantidade: 1200, estoqueConhecido: 5000 }));

    expect(bloqueios(achadas)).toEqual([]);
    expect(confirmacoes(achadas).map((a) => a.codigo)).toEqual(["quantidade_alta"]);
  });

  test("valor acima do normal pede confirmação", () => {
    expect(codigos(venda({ valor: 9000 }))).toContain("valor_alto");
  });

  test("saída maior que o estoque pede confirmação, e não trava a venda", () => {
    // O estoque pode estar atrás da realidade porque a entrada não foi
    // lançada. Travar o balcão por isso seria pior que o número negativo.
    const achadas = conferir(venda({ quantidade: 10, estoqueConhecido: 2 }));

    expect(bloqueios(achadas)).toEqual([]);
    expect(confirmacoes(achadas).map((a) => a.codigo)).toContain("estoque_negativo");
  });

  test("sem estoque conhecido, não inventa aviso de negativo", () => {
    expect(codigos(venda({ quantidade: 10, estoqueConhecido: null }))).toEqual([]);
  });

  test("lançamento igual a um de poucos minutos atrás pede confirmação", () => {
    // Quase nunca é uma segunda venda igual: é a mesma registrada duas vezes
    // porque ninguém teve certeza de que a primeira pegou.
    const agora = Date.parse("2026-10-31T12:00:00.000Z");
    const haUmMinuto = new Date(agora - 60_000).toISOString();

    expect(codigos(venda({ identicosRecentes: [haUmMinuto] }), agora)).toContain("repetida");
  });

  test("lançamento igual de horas atrás é venda normal", () => {
    const agora = Date.parse("2026-10-31T12:00:00.000Z");
    const haTresHoras = new Date(agora - 3 * 60 * 60 * 1000).toISOString();

    expect(repetidaRecente([haTresHoras], agora)).toBe(false);
    expect(codigos(venda({ identicosRecentes: [haTresHoras] }), agora)).toEqual([]);
  });

  test("data inválida na fila não derruba a conferência", () => {
    expect(repetidaRecente(["não é data"], Date.now())).toBe(false);
  });
});

test("lançamento normal não gera nada", () => {
  expect(conferir(venda())).toEqual([]);
});
