// Ordenação dos atalhos da tela de venda/compra. A regra é pura, então dá
// para conferi-la sem banco e sem tela.
import { describe, expect, test } from "vitest";

import { ordenarSugestoes } from "../src/lib/sugestoes";
import type { ProdutoLocal } from "../src/db/db";

function produto(id: string, nome: string): ProdutoLocal {
  return {
    id,
    nome,
    categoriaId: "cat-1",
    categoriaNome: "Ração",
    unidade: "kg",
    estoqueMinimo: 0,
    estoqueAtualServidor: 0,
  };
}

const CATALOGO = new Map(
  [
    produto("p1", "Ração 20kg"),
    produto("p2", "Milho a granel"),
    produto("p3", "Sal mineral"),
    produto("p4", "Farelo de soja"),
  ].map((p) => [p.id, p]),
);

const nomes = (produtos: ProdutoLocal[]) => produtos.map((p) => p.nome);

describe("ordem entre as duas fontes", () => {
  test("o que este aparelho registrou vem antes do que o servidor sugere", () => {
    // O histórico local é o sinal mais recente que o app tem: quem está com o
    // celular na mão hoje tende a repetir o que lançou ontem.
    const resultado = ordenarSugestoes(new Map([["p3", 5]]), ["p1", "p2"], CATALOGO);

    expect(nomes(resultado)[0]).toBe("Sal mineral");
  });

  test("o servidor completa o resto da lista", () => {
    const resultado = ordenarSugestoes(new Map([["p3", 5]]), ["p1", "p2"], CATALOGO);

    expect(nomes(resultado)).toEqual(["Sal mineral", "Ração 20kg", "Milho a granel"]);
  });

  test("aparelho novo, sem histórico local, ainda recebe atalhos", () => {
    // Sem isto, o funcionário novo abriria a tela sem atalho nenhum.
    const resultado = ordenarSugestoes(new Map(), ["p1", "p2"], CATALOGO);

    expect(nomes(resultado)).toEqual(["Ração 20kg", "Milho a granel"]);
  });

  test("um produto não aparece duas vezes", () => {
    const resultado = ordenarSugestoes(new Map([["p1", 3]]), ["p1", "p2"], CATALOGO);

    expect(nomes(resultado)).toEqual(["Ração 20kg", "Milho a granel"]);
  });
});

describe("regras de exibição", () => {
  test("mais lançado primeiro", () => {
    const resultado = ordenarSugestoes(
      new Map([
        ["p1", 2],
        ["p2", 9],
      ]),
      [],
      CATALOGO,
    );

    expect(nomes(resultado)).toEqual(["Milho a granel", "Ração 20kg"]);
  });

  test("empate resolvido pelo nome, para a lista não trocar de ordem sozinha", () => {
    // Um atalho que muda de lugar a cada abertura obriga a ler a lista toda
    // vez — e o atalho existe justamente para não precisar ler.
    const umaOrdem = ordenarSugestoes(
      new Map([
        ["p3", 1],
        ["p1", 1],
      ]),
      [],
      CATALOGO,
    );
    const outraOrdem = ordenarSugestoes(
      new Map([
        ["p1", 1],
        ["p3", 1],
      ]),
      [],
      CATALOGO,
    );

    expect(nomes(umaOrdem)).toEqual(nomes(outraOrdem));
  });

  test("produto que saiu do catálogo não vira atalho", () => {
    // Tocar nele levaria a uma tela de movimentação sem produto.
    const resultado = ordenarSugestoes(new Map([["p-sumido", 10]]), ["p1"], CATALOGO);

    expect(nomes(resultado)).toEqual(["Ração 20kg"]);
  });

  test("respeita o máximo pedido", () => {
    const resultado = ordenarSugestoes(new Map(), ["p1", "p2", "p3", "p4"], CATALOGO, 2);

    expect(resultado).toHaveLength(2);
  });
});
