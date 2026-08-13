import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { Link } from "react-router-dom";

interface MovimentacaoApi {
  id: string;
  tipo: "entrada" | "saida";
  motivo: string;
  quantidade: number;
  valor: number;
  criadoEm: string;
  origemDispositivo: string;
  produto: { nome: string; unidade: string };
  usuario: { nome: string };
}

// RF13: histórico/auditoria — só leitura, nunca editável (registro é append-only).
export function Historico() {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoApi[] | null>(
    null,
  );

  useEffect(() => {
    api<MovimentacaoApi[]>("/movimentacoes").then(setMovimentacoes);
  }, []);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Histórico de Movimentações</h1>
      <AdminNav />

      <ul className="cartao divide-y divide-gray-200">
        {movimentacoes?.map((mov) => (
          <li key={mov.id} className="py-2 text-sm">
            <div className="flex justify-between">
              <span
                className={
                  mov.tipo === "entrada" ? "text-green-700" : "text-red-700"
                }
              >
                {mov.tipo === "entrada" ? "Entrada" : "Saída"} · {mov.motivo}
              </span>
              <span className="text-gray-500">
                {new Date(mov.criadoEm).toLocaleString("pt-BR")}
              </span>
            </div>
            <div>
              {mov.produto.nome} — {mov.quantidade} {mov.produto.unidade} —{" "}
              {mov.usuario.nome}
            </div>
          </li>
        ))}
        {movimentacoes?.length === 0 && (
          <li className="py-2 text-sm text-gray-500">
            Nenhuma movimentação ainda.
          </li>
        )}
      </ul>
      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Sair
      </Link>
    </div>
  );
}
