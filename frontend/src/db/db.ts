import Dexie, { type Table } from "dexie";

// Armazenamento local (IndexedDB via Dexie) — é o que permite o app
// funcionar 100% offline. Ver docs/documento-de-visao.md, seção 5.4, sobre
// por que é IndexedDB e não SQLite nativo (decisão de ser PWA).

// Espelha UNIDADES em backend/src/lib/enums.ts. "un" é o que se conta em vez
// de pesar ou medir — balde, vassoura, cabo de enxada.
export type Unidade = "kg" | "L" | "un";

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

// Como a venda foi paga. Só existe em venda (tipo "saida", motivo "venda") —
// espelha FORMAS_PAGAMENTO em backend/src/lib/enums.ts.
export type FormaPagamento = "a_vista" | "fiado";
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

  // Só em venda. Ausentes nas movimentações gravadas antes desta versão do
  // app — a fila local pode ter lançamentos de antes esperando internet.
  formaPagamento?: FormaPagamento;
  cliente?: string; // quem levou fiado
}

// Atalhos de produto da tela de venda/compra, baixados junto com o catálogo.
// Guardados aqui, e não buscados na hora, porque a tela de movimentação
// precisa funcionar offline (RNF02) — inclusive no primeiro toque do dia,
// antes de qualquer sincronização.
export interface SugestoesLocais {
  tipo: TipoMovimentacao; // chave primária: uma linha para "entrada", outra para "saida"
  produtoIds: string[]; // já na ordem que o servidor considerou mais movimentada
}

class BancoLocal extends Dexie {
  produtos!: Table<ProdutoLocal, string>;
  categorias!: Table<CategoriaLocal, string>;
  movimentacoes!: Table<MovimentacaoLocal, string>;
  sugestoes!: Table<SugestoesLocais, string>;

  constructor() {
    super("estoque-casa-do-campo");
    // A versão 1 continua declarada: o Dexie usa a sequência de versões para
    // migrar o banco que já existe no celular de quem usa o app. Apagar a
    // versão antiga não "limpa" nada — faz o aparelho com dados antigos
    // falhar ao abrir.
    this.version(1).stores({
      produtos: "id, nome, categoriaId",
      categorias: "id, nome",
      movimentacoes: "id, produtoId, sincronizada, criadoEm",
    });
    this.version(2).stores({
      sugestoes: "tipo",
    });
    // O índice de formaPagamento é o que faz a lista de nomes já usados sair
    // rápido na tela de venda, sem varrer a fila inteira a cada tecla.
    this.version(3).stores({
      movimentacoes: "id, produtoId, sincronizada, criadoEm, formaPagamento",
    });
  }
}

export const db = new BancoLocal();
