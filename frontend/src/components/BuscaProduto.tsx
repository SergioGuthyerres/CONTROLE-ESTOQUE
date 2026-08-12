import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ProdutoLocal } from "../db/db";

// RF06: identificação de produto é só busca por nome — sem atalhos, sem
// código, sem QR Code (decisão da seção 5.1 do documento de visão).
export function BuscaProduto({ onEscolher }: { onEscolher: (produto: ProdutoLocal) => void }) {
  const [texto, setTexto] = useState("");

  const produtos = useLiveQuery(() => db.produtos.orderBy("nome").toArray(), []);

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
    </div>
  );
}
