import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ProdutoLocal, type TipoMovimentacao } from "../db/db";
import { sugestoesDeProduto } from "../lib/sugestoes";

// RF06: identificação de produto continua sendo busca por nome. O que muda é
// o que aparece ANTES de digitar: os produtos mais movimentados neste tipo,
// como atalho.
//
// Isso não contradiz a decisão da seção 5.1 do documento de visão (nada de
// código de barras, QR Code ou catálogo por categoria). Ali o que se recusou
// foi trocar a busca por outro sistema de identificação, que exige a pessoa
// aprender algo novo. Aqui a busca continua sendo a busca; o atalho só evita
// digitar de novo o nome do que sai todo dia (RNF05: mínimo de passos).
export function BuscaProduto({
  onEscolher,
  tipo,
}: {
  onEscolher: (produto: ProdutoLocal) => void;
  tipo?: TipoMovimentacao;
}) {
  const [texto, setTexto] = useState("");

  const produtos = useLiveQuery(() => db.produtos.orderBy("nome").toArray(), []);

  // Recalculado quando o catálogo ou a fila local mudam — o produto lançado
  // agora há pouco precisa aparecer no atalho da próxima venda.
  const sugestoes = useLiveQuery(
    () => (tipo ? sugestoesDeProduto(tipo) : Promise.resolve([])),
    [tipo],
    [] as ProdutoLocal[],
  );

  const resultados = useMemo(() => {
    if (!produtos) return [];
    const termo = texto.trim().toLowerCase();
    if (!termo) return [];
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo)).slice(0, 20);
  }, [produtos, texto]);

  return (
    <div>
      <input
        className="campo"
        placeholder="Digite o nome do produto..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
      />
      {resultados.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-200 cartao">
          {resultados.map((produto) => (
            <li key={produto.id}>
              <button
                type="button"
                className="w-full text-left py-3 px-2 active:bg-gray-100"
                onClick={() => {
                  onEscolher(produto);
                  setTexto("");
                }}
              >
                <div className="font-medium">{produto.nome}</div>
                <div className="text-sm text-gray-500">
                  {produto.categoriaNome} · {produto.unidade}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {texto.trim() && resultados.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">Nenhum produto encontrado.</p>
      )}

      {/* Só enquanto o campo está vazio: depois que a pessoa começou a
          digitar, ela já sabe o que procura e o atalho vira ruído. */}
      {!texto.trim() && sugestoes.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-gray-500 mb-2">Mais usados</p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((produto) => (
              <button
                key={produto.id}
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-left"
                onClick={() => onEscolher(produto)}
              >
                {produto.nome}
                <span className="text-gray-500"> · {produto.unidade}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
