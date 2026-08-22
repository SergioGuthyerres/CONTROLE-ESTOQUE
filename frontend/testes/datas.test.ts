// A conversão dia → instante é a parte do filtro por data que erra em
// silêncio: o resultado sai plausível e errado por três horas.
import { describe, expect, test } from "vitest";

import { diaLocal, fimDoDiaLocal, inicioDoDiaLocal, somarDias } from "../src/lib/datas";

describe("dia escolhido na tela → instante enviado à API", () => {
  test("o início do dia é meia-noite local, não meia-noite em UTC", () => {
    const inicio = inicioDoDiaLocal("2026-08-21");

    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(7); // agosto
    expect(inicio.getDate()).toBe(21);
    expect(inicio.getHours()).toBe(0);
    expect(inicio.getMinutes()).toBe(0);
  });

  test("o fim do dia inclui o último instante", () => {
    const fim = fimDoDiaLocal("2026-08-21");

    expect(fim.getDate()).toBe(21);
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
    expect(fim.getSeconds()).toBe(59);
  });

  test("o intervalo de um dia cobre exatamente 24 horas", () => {
    const inicio = inicioDoDiaLocal("2026-08-21").getTime();
    const fim = fimDoDiaLocal("2026-08-21").getTime();

    expect(fim - inicio).toBe(24 * 60 * 60 * 1000 - 1);
  });

  test("uma venda das 21h entra no dia em que ela aconteceu para quem está na loja", () => {
    // O caso que motivou o módulo: em UTC-3, 21h do dia 21 é 00h do dia 22 em
    // UTC. Filtrar com a data crua ("2026-08-21") jogaria a venda para o dia
    // seguinte e o fechamento do caixa não bateria.
    const venda = new Date(2026, 7, 21, 21, 0, 0);

    expect(venda.getTime()).toBeGreaterThanOrEqual(inicioDoDiaLocal("2026-08-21").getTime());
    expect(venda.getTime()).toBeLessThanOrEqual(fimDoDiaLocal("2026-08-21").getTime());
    expect(venda.getTime()).toBeLessThan(inicioDoDiaLocal("2026-08-22").getTime());
  });
});

describe("navegação por dias", () => {
  test("ida e volta entre Date e AAAA-MM-DD preserva o dia", () => {
    expect(diaLocal(inicioDoDiaLocal("2026-08-21"))).toBe("2026-08-21");
  });

  test("um dígito vira dois", () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("somar dias atravessa o mês", () => {
    expect(somarDias("2026-08-31", 1)).toBe("2026-09-01");
  });

  test("subtrair dias atravessa o ano", () => {
    expect(somarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  test("os últimos 7 dias incluem hoje", () => {
    // A conta usada pelo atalho da tela: 7 dias contando hoje volta 6.
    expect(somarDias("2026-08-21", -6)).toBe("2026-08-15");
  });
});
