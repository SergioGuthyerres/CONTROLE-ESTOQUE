import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";

interface Alerta {
  produtoId: string;
  produtoNome: string;
  tipo: "negativo" | "minimo";
  estoqueAtual: number;
}
interface ResumoDashboard {
  totalProdutos: number;
  valorTotalEstoque: number;
  movimentacoesUltimos30Dias: number;
  alertas: Alerta[];
}

// RF08 — só funciona online (é o painel do admin, não precisa ser offline-first).
export function Dashboard() {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<ResumoDashboard>("/dashboard")
      .then(setResumo)
      .catch(() => setErro("Não foi possível carregar o dashboard. Verifique a internet."));
  }, []);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Painel Administrativo</h1>

      <AdminNav />

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="cartao">
              <div className="text-sm text-gray-500">Produtos cadastrados</div>
              <div className="text-2xl font-semibold">{resumo.totalProdutos}</div>
            </div>
            <div className="cartao">
              <div className="text-sm text-gray-500">Valor em estoque</div>
              <div className="text-2xl font-semibold">
                {resumo.valorTotalEstoque.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="cartao col-span-2">
              <div className="text-sm text-gray-500">Movimentações (últimos 30 dias)</div>
              <div className="text-2xl font-semibold">{resumo.movimentacoesUltimos30Dias}</div>
            </div>
          </div>

          <div className="cartao">
            <div className="font-medium mb-2">Alertas ({resumo.alertas.length})</div>
            {resumo.alertas.length === 0 && <p className="text-sm text-gray-500">Nenhum alerta ativo.</p>}
            <ul className="divide-y divide-gray-200">
              {resumo.alertas.map((alerta) => (
                <li key={alerta.produtoId} className="py-2 text-sm">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                      alerta.tipo === "negativo" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {alerta.tipo === "negativo" ? "Estoque negativo" : "Estoque mínimo"}
                  </span>
                  {alerta.produtoNome} — {alerta.estoqueAtual}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
