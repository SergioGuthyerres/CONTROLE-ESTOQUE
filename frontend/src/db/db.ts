import Dexie, { type Table } from "dexie";

// Armazenamento local (IndexedDB via Dexie) — é o que permite o app
// funcionar 100% offline. Ver docs/documento-de-visao.md, seção 5.4, sobre
// por que é IndexedDB e não SQLite nativo (decisão de ser PWA).

export type Unidade = "kg" | "L";

export interface ProdutoLocal {
  id: string;
  nome: string;
  categoriaId: string;
  categoriaNome: string;
  unidade: Unidade;
  estoqueMinimo: number;
  // Último valor conhecido do servidor — pode estar defasado se houver
  // movimentações locais ainda não sincronizadas (ver estoqueLocalDeProduto
  // em src/lib/estoque.ts, que soma as pendentes por cima deste valor).
  estoqueAtualServidor: number;
}

export interface CategoriaLocal {
  id: string;
  nome: string;
}

export type TipoMovimentacao = "entrada" | "saida";
export type MotivoMovimentacao =
  | "compra"
  | "devolucao"
  | "venda"
  | "perda"
  | "uso_interno"
  | "inventario"
  // Criado só pelo servidor, ao desfazer uma movimentação pelo histórico.
  // Nunca é gravado nesta fila local: o estorno nasce no painel, online.
  | "estorno";

export interface MovimentacaoLocal {
  id: string; // uuid gerado no cliente — chave de idempotência na sincronização
  produtoId: string;
  produtoNome: string; // duplicado aqui de propósito, pra listar sem precisar de join
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  origemDispositivo: string;
  criadoEm: string; // ISO 8601
  sincronizada: 0 | 1; // Dexie não indexa booleano bem — usar 0/1
}

class BancoLocal extends Dexie {
  produtos!: Table<ProdutoLocal, string>;
  categorias!: Table<CategoriaLocal, string>;
  movimentacoes!: Table<MovimentacaoLocal, string>;

  constructor() {
    super("estoque-casa-do-campo");
    this.version(1).stores({
      produtos: "id, nome, categoriaId",
      categorias: "id, nome",
      movimentacoes: "id, produtoId, sincronizada, criadoEm",
    });
  }
}

export const db = new BancoLocal();
