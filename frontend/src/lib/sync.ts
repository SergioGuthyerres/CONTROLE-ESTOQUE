import { api } from "./api";
import { db } from "../db/db";

interface ProdutoApi {
  id: string;
  nome: string;
  categoriaId: string;
  unidade: "kg" | "L";
  estoqueMinimo: number;
  estoqueAtual: number;
  categoria: { nome: string };
}
interface CategoriaApi {
  id: string;
  nome: string;
}

// Atualiza o cache local de produtos/categorias com o que está no servidor.
// Chamado ao logar e depois de cada sincronização de movimentações — é o
// que faz o "estoqueAtualServidor" local deixar de estar defasado.
export async function baixarCatalogo(): Promise<void> {
  const [produtos, categorias] = await Promise.all([
    api<ProdutoApi[]>("/produtos"),
    api<CategoriaApi[]>("/categorias"),
  ]);

  await db.transaction("rw", db.produtos, db.categorias, async () => {
    await db.categorias.clear();
    await db.categorias.bulkPut(categorias);

    await db.produtos.clear();
    await db.produtos.bulkPut(
      produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoriaId: p.categoriaId,
        categoriaNome: p.categoria.nome,
        unidade: p.unidade,
        estoqueMinimo: p.estoqueMinimo,
        estoqueAtualServidor: p.estoqueAtual,
      }))
    );
  });
}

// Envia as movimentações feitas offline (ou qualquer uma ainda não
// confirmada) para o servidor. Idempotente: pode chamar de novo sem medo,
// o backend ignora quem já foi recebido (ver POST /movimentacoes/sync).
export async function sincronizarMovimentacoes(): Promise<{ enviadas: number }> {
  const pendentes = await db.movimentacoes.where({ sincronizada: 0 }).toArray();
  if (pendentes.length === 0) return { enviadas: 0 };

  await api("/movimentacoes/sync", {
    method: "POST",
    body: JSON.stringify({
      movimentacoes: pendentes.map((m) => ({
        id: m.id,
        produtoId: m.produtoId,
        tipo: m.tipo,
        motivo: m.motivo,
        quantidade: m.quantidade,
        valor: m.valor,
        origemDispositivo: m.origemDispositivo,
        criadoEm: m.criadoEm,
      })),
    }),
  });

  await db.movimentacoes
    .where("id")
    .anyOf(pendentes.map((m) => m.id))
    .modify({ sincronizada: 1 });

  await baixarCatalogo();
  return { enviadas: pendentes.length };
}

let sincronizando = false;

// Roda a sincronização com uma trava simples pra não disparar em paralelo
// se o usuário voltar a ficar online e o intervalo periódico coincidirem.
export async function sincronizarSePossivel(): Promise<void> {
  if (!navigator.onLine || sincronizando) return;
  sincronizando = true;
  try {
    await sincronizarMovimentacoes();
  } catch (erro) {
    console.warn("Falha ao sincronizar — tenta de novo mais tarde.", erro);
  } finally {
    sincronizando = false;
  }
}

export function iniciarSincronizacaoAutomatica(): () => void {
  sincronizarSePossivel();
  const aoFicarOnline = () => sincronizarSePossivel();
  window.addEventListener("online", aoFicarOnline);
  const intervalo = setInterval(sincronizarSePossivel, 60_000);

  return () => {
    window.removeEventListener("online", aoFicarOnline);
    clearInterval(intervalo);
  };
}
