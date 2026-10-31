import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ProdutoLocal, type TipoMovimentacao } from "../db/db";
import { sugestoesDeProduto } from "../lib/sugestoes";
import { BotaoVerMais, useExpansivel } from "./ListaExpansivel";

// RF06: identificação de produto continua sendo busca por nome. O que muda é
// o que aparece ANTES de digitar: os mais movimentados como atalho, e abaixo
// o catálogo inteiro.
//
// O catálogo inteiro é novidade. Antes, com o campo vazio, só existiam os
// "mais usados" — e quem não achava o produto entre aqueles seis tinha de
// adivinhar o nome exato para a busca encontrar. Agora a lista está lá, com
// a quantidade em estoque de cada um, cortada no começo e aberta no toque
// (ver ListaExpansivel).
//
// Isso não contradiz a decisão da seção 5.1 do documento de visão (nada de
// código de barras, QR Code ou catálogo por categoria). Ali o que se recusou
// foi trocar a busca por outro sistema de identificação; aqui a busca
// continua sendo a busca.
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

  const termo = texto.trim().toLocaleLowerCase("pt-BR");

  const encontrados = useMemo(() => {
    if (!produtos) return [];
    if (!termo) return produtos;
    return produtos.filter((p) => p.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [produtos, termo]);

  const lista = useExpansivel(encontrados.length, termo ? 12 : 8);

  return (
    <div className="space-y-3">
      <input
        className="campo"
        placeholder="Digite o nome do produto..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
      />

      {/* Só enquanto o campo está vazio: depois que a pessoa começou a
          digitar, ela já sabe o que procura e o atalho vira ruído. */}
      {!termo && sugestoes.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-gray-500">Mais usados</p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((produto) => (
              <button
                key={produto.id}
                type="button"
                className="rounded-lg border border-gray-300 bg-superficie px-3 py-2 text-left text-sm"
                onClick={() => onEscolher(produto)}
              >
                {produto.nome}
                <span className="text-gray-500"> · {produto.unidade}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {termo && encontrados.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum produto com esse nome.</p>
      )}

      {encontrados.length > 0 && (
        <div>
          {!termo && (
            <p className="mb-2 text-sm text-gray-500">
              Todos os produtos ({encontrados.length})
            </p>
          )}
          <ul className="divide-y divide-gray-200">
            {encontrados.slice(0, lista.limite).map((produto) => (
              <li key={produto.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left active:bg-gray-100"
                  onClick={() => {
                    onEscolher(produto);
                    setTexto("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{produto.nome}</span>
                    <span className="block text-xs text-gray-500">{produto.categoriaNome}</span>
                  </span>
                  {/* A quantidade ao lado do nome responde "tem quanto disso?"
                      sem sair da tela de venda, que é onde a pergunta nasce. */}
                  <span className="shrink-0 whitespace-nowrap text-sm text-gray-500">
                    {produto.estoqueAtualServidor} {produto.unidade}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <BotaoVerMais
            expandido={lista.expandido}
            restantes={lista.restantes}
            aoAbrir={lista.abrir}
            aoFechar={lista.fechar}
            rotulo="produtos"
          />
        </div>
      )}
    </div>
  );
}
