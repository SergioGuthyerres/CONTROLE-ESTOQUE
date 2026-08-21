// Testes da sincronização offline — a parte tecnicamente mais delicada do
// app e a que estava sem cobertura nenhuma.
//
// O servidor é substituído por um duplo do módulo src/lib/api: o que se testa
// aqui não é o fetch, é a coreografia entre a fila local e o catálogo.
import { beforeEach, describe, expect, test, vi } from "vitest";

const chamadas: { caminho: string; corpo?: unknown }[] = [];
let produtosDoServidor: unknown[] = [];
let categoriasDoServidor: unknown[] = [];
let sugestoesDoServidor: string[] = [];
let enviosFeitos = 0;
let falharNoEnvioNumero: number | null = null;

vi.mock("../src/lib/api", () => ({
  api: async (caminho: string, opcoes?: RequestInit) => {
    chamadas.push({
      caminho,
      corpo: opcoes?.body ? JSON.parse(String(opcoes.body)) : undefined,
    });
    if (caminho === "/produtos") return produtosDoServidor;
    if (caminho === "/categorias") return categoriasDoServidor;
    if (caminho.startsWith("/produtos/mais-movimentados")) return sugestoesDoServidor;
    if (caminho === "/movimentacoes/sync") {
      enviosFeitos += 1;
      if (falharNoEnvioNumero === enviosFeitos) throw new Error("rede caiu");
      return { sincronizadas: 1 };
    }
    throw new Error(`Rota não prevista no teste: ${caminho}`);
  },
}));

const { db } = await import("../src/db/db");
const { sincronizar, baixarCatalogo, enviarMovimentacoesPendentes } = await import(
  "../src/lib/sync"
);
const { estoqueLocalDeProduto } = await import("../src/lib/estoque");

function produtoApi(id: string, nome: string, estoqueAtual: number) {
  return {
    id,
    nome,
    categoriaId: "cat-1",
    unidade: "kg" as const,
    estoqueMinimo: 0,
    estoqueAtual,
    categoria: { nome: "Ração" },
  };
}

function movimentacaoLocal(id: string, produtoId: string, quantidade: number) {
  return {
    id,
    produtoId,
    produtoNome: "Ração 20kg",
    tipo: "saida" as const,
    motivo: "venda" as const,
    quantidade,
    valor: 0,
    origemDispositivo: "dispositivo-de-teste",
    criadoEm: new Date().toISOString(),
    sincronizada: 0 as const,
  };
}

beforeEach(async () => {
  chamadas.length = 0;
  categoriasDoServidor = [{ id: "cat-1", nome: "Ração" }];
  sugestoesDoServidor = [];
  enviosFeitos = 0;
  falharNoEnvioNumero = null;
  produtosDoServidor = [produtoApi("prod-1", "Ração 20kg", 10)];
  await db.produtos.clear();
  await db.categorias.clear();
  await db.movimentacoes.clear();
  await db.sugestoes.clear();
});

describe("catálogo", () => {
  test("baixa o catálogo mesmo sem nenhuma movimentação pendente", async () => {
    // Regressão: antes, baixar o catálogo era a última linha do envio da fila
    // e era pulado junto com ele quando não havia nada para enviar. Um
    // aparelho em dia nunca recebia produto novo, e a única forma de ver o
    // que foi cadastrado em outro celular era sair da conta e entrar de novo.
    await sincronizar();

    expect(chamadas.map((c) => c.caminho)).toContain("/produtos");
    expect(await db.produtos.count()).toBe(1);
  });

  test("não chama a rota de envio quando a fila está vazia", async () => {
    await sincronizar();
    expect(chamadas.map((c) => c.caminho)).not.toContain("/movimentacoes/sync");
  });

  test("traz para o cache local o produto cadastrado em outro aparelho", async () => {
    await baixarCatalogo();
    expect(await db.produtos.count()).toBe(1);

    produtosDoServidor = [
      produtoApi("prod-1", "Ração 20kg", 10),
      produtoApi("prod-2", "Milho a granel", 40),
    ];
    await baixarCatalogo();

    const nomes = (await db.produtos.orderBy("nome").toArray()).map((p) => p.nome);
    expect(nomes).toEqual(["Milho a granel", "Ração 20kg"]);
  });

  test("remove do cache local o que sumiu do servidor", async () => {
    produtosDoServidor = [
      produtoApi("prod-1", "Ração 20kg", 10),
      produtoApi("prod-2", "Milho a granel", 40),
    ];
    await baixarCatalogo();
    expect(await db.produtos.count()).toBe(2);

    produtosDoServidor = [produtoApi("prod-1", "Ração 20kg", 10)];
    await baixarCatalogo();

    expect(await db.produtos.count()).toBe(1);
    expect(await db.produtos.get("prod-2")).toBeUndefined();
  });

  test("atualiza o estoque de um produto que já estava no cache", async () => {
    await baixarCatalogo();
    expect((await db.produtos.get("prod-1"))?.estoqueAtualServidor).toBe(10);

    produtosDoServidor = [produtoApi("prod-1", "Ração 20kg", 3)];
    await baixarCatalogo();

    expect((await db.produtos.get("prod-1"))?.estoqueAtualServidor).toBe(3);
  });
});

describe("fila de movimentações", () => {
  test("envia as pendentes e as marca como sincronizadas", async () => {
    await db.movimentacoes.bulkAdd([
      movimentacaoLocal("mov-1", "prod-1", 2),
      movimentacaoLocal("mov-2", "prod-1", 3),
    ]);

    const { enviadas } = await enviarMovimentacoesPendentes();

    expect(enviadas).toBe(2);
    const envio = chamadas.find((c) => c.caminho === "/movimentacoes/sync");
    expect(envio).toBeDefined();
    expect((envio!.corpo as { movimentacoes: unknown[] }).movimentacoes).toHaveLength(2);
    expect(await db.movimentacoes.where({ sincronizada: 0 }).count()).toBe(0);
  });

  test("fila maior que o lote é enviada em partes", async () => {
    // Regressão: a fila inteira ia numa requisição só, e o backend recusa
    // lotes acima de 200 com 400. Um aparelho que passasse muito tempo
    // offline travava a sincronização para sempre — e quanto mais tempo
    // offline, mais impossível de destravar ficava.
    const muitas = Array.from({ length: 250 }, (_, indice) =>
      movimentacaoLocal(`mov-${String(indice).padStart(3, "0")}`, "prod-1", 1),
    );
    await db.movimentacoes.bulkAdd(muitas);

    const { enviadas } = await enviarMovimentacoesPendentes();

    const envios = chamadas.filter((c) => c.caminho === "/movimentacoes/sync");
    expect(enviadas).toBe(250);
    expect(envios).toHaveLength(2);
    expect((envios[0].corpo as { movimentacoes: unknown[] }).movimentacoes).toHaveLength(200);
    expect((envios[1].corpo as { movimentacoes: unknown[] }).movimentacoes).toHaveLength(50);
    expect(await db.movimentacoes.where({ sincronizada: 0 }).count()).toBe(0);
  });

  test("um lote que falha não desmarca o que já tinha sido confirmado", async () => {
    const muitas = Array.from({ length: 250 }, (_, indice) =>
      movimentacaoLocal(`mov-${String(indice).padStart(3, "0")}`, "prod-1", 1),
    );
    await db.movimentacoes.bulkAdd(muitas);
    falharNoEnvioNumero = 2;

    await expect(enviarMovimentacoesPendentes()).rejects.toThrow();

    // As 200 do primeiro lote chegaram ao servidor e ficam marcadas; só as 50
    // do lote que falhou continuam na fila para a próxima tentativa.
    expect(await db.movimentacoes.where({ sincronizada: 0 }).count()).toBe(50);
  });

  test("uma segunda sincronização não reenvia o que já foi confirmado", async () => {
    await db.movimentacoes.add(movimentacaoLocal("mov-1", "prod-1", 2));
    await sincronizar();
    chamadas.length = 0;

    await sincronizar();

    expect(chamadas.map((c) => c.caminho)).not.toContain("/movimentacoes/sync");
  });

  test("envia a fila antes de baixar o catálogo", async () => {
    // A ordem importa: baixar primeiro traria um estoque que ainda não
    // contabiliza o que este aparelho fez offline, e o cache local ficaria
    // com um número que já nasce errado.
    await db.movimentacoes.add(movimentacaoLocal("mov-1", "prod-1", 2));

    await sincronizar();

    const caminhos = chamadas.map((c) => c.caminho);
    expect(caminhos.indexOf("/movimentacoes/sync")).toBeLessThan(caminhos.indexOf("/produtos"));
  });
});

describe("estoque mostrado na tela", () => {
  test("soma as movimentações pendentes por cima do valor do servidor", async () => {
    await baixarCatalogo();
    await db.movimentacoes.add(movimentacaoLocal("mov-1", "prod-1", 4));

    const produto = (await db.produtos.get("prod-1"))!;
    expect(await estoqueLocalDeProduto(produto)).toBe(6); // 10 do servidor - 4 de saída
  });

  test("não conta em dobro depois que a movimentação sincroniza", async () => {
    await baixarCatalogo();
    await db.movimentacoes.add(movimentacaoLocal("mov-1", "prod-1", 4));

    // O servidor já contabilizou a saída e passa a devolver 6.
    produtosDoServidor = [produtoApi("prod-1", "Ração 20kg", 6)];
    await sincronizar();

    const produto = (await db.produtos.get("prod-1"))!;
    expect(await estoqueLocalDeProduto(produto)).toBe(6);
  });
});
