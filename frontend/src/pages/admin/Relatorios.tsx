import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";

interface LinhaMovimentacao {
  produtoId: string;
  produtoNome: string;
  totalMovimentado: number;
}
interface LinhaValor {
  produtoId: string;
  produtoNome: string;
  estoqueAtual: number;
  custoMedioUnitario: number;
  valorEstoque: number;
}

// RF11 + RF12.
export function Relatorios() {
  const [maisMovimentados, setMaisMovimentados] = useState<LinhaMovimentacao[] | null>(null);
  const [valorEstoque, setValorEstoque] = useState<{ linhas: LinhaValor[]; valorTotal: number } | null>(null);

  useEffect(() => {
    api<LinhaMovimentacao[]>("/relatorios/movimentacao-por-produto").then(setMaisMovimentados);
    api<{ linhas: LinhaValor[]; valorTotal: number }>("/relatorios/valor-total-estoque").then(setValorEstoque);
  }, []);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Relatórios</h1>
      <AdminNav />

      <div className="cartao">
        <div className="font-medium mb-2">Produtos mais movimentados</div>
        <ol className="divide-y divide-gray-200">
          {maisMovimentados?.map((linha, indice) => (
            <li key={linha.produtoId} className="py-2 text-sm flex justify-between">
              <span>{indice + 1}. {linha.produtoNome}</span>
              <span className="text-gray-500">{linha.totalMovimentado}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="cartao">
        <div className="font-medium mb-1">Valor total em estoque</div>
        <div className="text-2xl font-semibold mb-2">
          {valorEstoque?.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
        <ul className="divide-y divide-gray-200">
          {valorEstoque?.linhas.map((linha) => (
            <li key={linha.produtoId} className="py-2 text-sm flex justify-between">
              <span>{linha.produtoNome}</span>
              <span className="text-gray-500">
                {linha.valorEstoque.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
