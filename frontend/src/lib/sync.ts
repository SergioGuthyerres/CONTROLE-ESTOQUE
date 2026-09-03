import { api } from "./api";
import { db, type Unidade } from "../db/db";

interface ProdutoApi {
  id: string;
  nome: string;
  categoriaId: string;
  // Reaproveita o tipo do banco local em vez de repetir a lista: quando uma
  // unidade nova entra em db.ts, esta linha acompanha sozinha.
  unidade: Unidade;
  estoqueMinimo: number;
  estoqueAtual: number;
  categoria: { nome: string };
}
interface CategoriaApi {
  id: string;
  nome: string;
}

// Atalhos da tela de venda/compra. Baixados junto com o catálogo, e não na
// hora de abrir a tela, porque essa tela precisa funcionar offline.
//
// Deliberadamente à prova de falha e SEPARADO do catálogo: atalho é
// conveniência, catálogo é o app. Enquanto os dois vinham no mesmo
// `Promise.all`, um 404 aqui rejeitava a promessa inteira e derrubava
// produtos e categorias junto — o funcionário abria uma tela de venda sem
// nenhum produto, e sem nada na tela explicando por quê.
//
// E 404 aqui não é hipótese: o PWA se publica sozinho a cada merge na main,
// enquanto a API é atualizada à mão no servidor. Entre um deploy e outro, o
// app novo conversa com a API antiga — que ainda não conhece as rotas novas.
// Toda rota adicionada depois de uma versão já publicada precisa ser tratada
// como opcional por este motivo.
async function atualizarSugestoes(): Promise<void> {
  const resultados = await Promise.allSettled([
    api<string[]>("/produtos/mais-movimentados?tipo=entrada"),
    api<string[]>("/produtos/mais-movimentados?tipo=saida"),
  ]);

  const tipos = ["entrada", "saida"] as const;
  const novas = resultados.flatMap((resultado, indice) =>
    resultado.status === "fulfilled"
      ? [{ tipo: tipos[indice], produtoIds: resultado.value }]
      : [],
  );

  // Só grava o que veio. Se a rota falhar, o aparelho segue com os atalhos da
  // última vez que deu certo — melhor do que apagá-los.
  if (novas.length > 0) await db.sugestoes.bulkPut(novas);
}

// Atualiza o cache local de produtos/categorias com o que está no servidor.
// É o único caminho pelo qual uma mudança feita em OUTRO aparelho (um produto
// novo cadastrado no celular do dono, uma venda lançada por outro funcionário)
// chega até aqui.
export async function baixarCatalogo(): Promise<void> {
  const [produtos, categorias] = await Promise.all([
    api<ProdutoApi[]>("/produtos"),
    api<CategoriaApi[]>("/categorias"),
  ]);

  await db.transaction("rw", db.produtos, db.categorias, async () => {
    // Substituir registro a registro em vez de `clear()` + `bulkPut()`: o
    // clear deixava as tabelas vazias por um instante dentro da transação, e
    // as telas que leem com useLiveQuery chegavam a pintar "nenhum produto
    // encontrado" no meio de uma atualização de rotina.
    await db.categorias.bulkPut(categorias);
    await db.produtos.bulkPut(
      produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoriaId: p.categoriaId,
        categoriaNome: p.categoria.nome,
        unidade: p.unidade,
        estoqueMinimo: p.estoqueMinimo,
        estoqueAtualServidor: p.estoqueAtual,
      })),
    );

    // O que sumiu do servidor precisa sumir daqui também, senão um produto
    // apagado continua aparecendo na busca deste aparelho para sempre.
    const idsNoServidor = new Set(produtos.map((p) => p.id));
    const produtosLocais = await db.produtos.toCollection().primaryKeys();
    const produtosSumidos = produtosLocais.filter((id) => !idsNoServidor.has(id));
    if (produtosSumidos.length > 0) await db.produtos.bulkDelete(produtosSumidos);

    const idsCategorias = new Set(categorias.map((c) => c.id));
    const categoriasLocais = await db.categorias.toCollection().primaryKeys();
    const categoriasSumidas = categoriasLocais.filter((id) => !idsCategorias.has(id));
    if (categoriasSumidas.length > 0) await db.categorias.bulkDelete(categoriasSumidas);
  });

  // Por último e sem `await` no caminho de erro: o catálogo já está salvo, e
  // nada daqui para baixo pode desfazer isso.
  await atualizarSugestoes().catch(() => {});
}

// Teto de movimentações por requisição. Precisa ser <= ao limite do zod em
// backend/src/routes/movimentacoes.ts: o servidor recusa o lote inteiro com
// 400 se passar disso, e a fila do aparelho travaria para sempre — quanto
// mais tempo offline, mais impossível de sincronizar ficaria.
const MAXIMO_POR_LOTE = 200;

// Envia as movimentações feitas offline (ou qualquer uma ainda não
// confirmada) para o servidor. Idempotente: pode chamar de novo sem medo,
// o backend ignora quem já foi recebido (ver POST /movimentacoes/sync).
export async function enviarMovimentacoesPendentes(): Promise<{ enviadas: number }> {
  const pendentes = await db.movimentacoes.where({ sincronizada: 0 }).toArray();
  if (pendentes.length === 0) return { enviadas: 0 };

  // Da mais antiga para a mais nova: se a conexão cair no meio, o que ficou
  // para trás é o mais recente, que é o mais fácil de conferir depois.
  pendentes.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  let enviadas = 0;

  for (let inicio = 0; inicio < pendentes.length; inicio += MAXIMO_POR_LOTE) {
    const lote = pendentes.slice(inicio, inicio + MAXIMO_POR_LOTE);

    await api("/movimentacoes/sync", {
      method: "POST",
      body: JSON.stringify({
        movimentacoes: lote.map((m) => ({
          id: m.id,
          produtoId: m.produtoId,
          tipo: m.tipo,
          motivo: m.motivo,
          quantidade: m.quantidade,
          valor: m.valor,
          origemDispositivo: m.origemDispositivo,
          criadoEm: m.criadoEm,
          // Só vão quando existem: o servidor recusa forma de pagamento em
          // movimentação que não é venda, e a fila pode ter lançamentos
          // gravados antes desta versão do app.
          ...(m.formaPagamento ? { formaPagamento: m.formaPagamento } : {}),
          ...(m.cliente ? { cliente: m.cliente } : {}),
        })),
      }),
    });

    // Marca lote a lote, e não tudo no fim: se o envio parar no meio, o que
    // já chegou fica marcado e o próximo ciclo continua de onde parou.
    await db.movimentacoes
      .where("id")
      .anyOf(lote.map((m) => m.id))
      .modify({ sincronizada: 1 });

    enviadas += lote.length;
  }

  return { enviadas };
}

// Um ciclo completo: sobe o que este aparelho fez, desce o que o mundo fez.
//
// As duas metades são independentes de propósito. Antes, baixar o catálogo era
// a última linha do envio e só acontecia quando havia fila para enviar — um
// aparelho que só consultava (ou que estava em dia) nunca recebia nada novo, e
// a única forma de ver um produto cadastrado em outro celular era sair da
// conta e entrar de novo, porque o login era o outro lugar que baixava o
// catálogo.
export async function sincronizar(): Promise<{ enviadas: number }> {
  const resultado = await enviarMovimentacoesPendentes();
  await baixarCatalogo();
  return resultado;
}

let sincronizando = false;

// Roda a sincronização com uma trava simples pra não disparar em paralelo
// se o usuário voltar a ficar online e o intervalo periódico coincidirem.
export async function sincronizarSePossivel(): Promise<void> {
  if (!navigator.onLine || sincronizando) return;
  sincronizando = true;
  try {
    await sincronizar();
  } catch (erro) {
    console.warn("Falha ao sincronizar — tenta de novo mais tarde.", erro);
  } finally {
    sincronizando = false;
  }
}

const INTERVALO_MS = 60_000;

export function iniciarSincronizacaoAutomatica(): () => void {
  sincronizarSePossivel();

  const aoFicarOnline = () => sincronizarSePossivel();

  // No celular, o app instalado passa horas em segundo plano e o sistema
  // congela o setInterval enquanto isso. Sem este gatilho, quem volta ao app
  // depois de um tempo olha para dados velhos até o próximo tick acordar —
  // que era exatamente a sensação de "só atualiza se eu sair e entrar".
  const aoVoltarAoApp = () => {
    if (document.visibilityState === "visible") sincronizarSePossivel();
  };

  window.addEventListener("online", aoFicarOnline);
  document.addEventListener("visibilitychange", aoVoltarAoApp);
  const intervalo = setInterval(sincronizarSePossivel, INTERVALO_MS);

  return () => {
    window.removeEventListener("online", aoFicarOnline);
    document.removeEventListener("visibilitychange", aoVoltarAoApp);
    clearInterval(intervalo);
  };
}
