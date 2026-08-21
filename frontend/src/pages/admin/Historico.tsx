import { useCallback, useEffect, useState } from "react";
import { api, ErroApi } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { Link } from "react-router-dom";
import { ROTULO_MOTIVO, ROTULO_TIPO } from "../../lib/enums";
import { baixarCatalogo } from "../../lib/sync";
import type { MotivoMovimentacao, TipoMovimentacao } from "../../db/db";

interface LigacaoEstorno {
  id: string;
  criadoEm: string;
}

interface MovimentacaoApi {
  id: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  criadoEm: string;
  origemDispositivo: string;
  produto: { nome: string; unidade: string };
  usuario: { nome: string };
  // Presente = esta movimentação já foi desfeita.
  estorno: LigacaoEstorno | null;
  // Presente = esta linha É o desfazer de outra.
  estornoDe: LigacaoEstorno | null;
}

// RF13: histórico/auditoria. Continua sendo append-only — "Desfazer" não apaga
// nem edita nada, cria a movimentação inversa (ver
// backend/src/services/estornoService.ts). Por isso o erro e a correção
// aparecem os dois na lista, e é assim que tem que ser.
export function Historico() {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoApi[] | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setMovimentacoes(await api<MovimentacaoApi[]>("/movimentacoes"));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o histórico.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function desfazer(id: string) {
    setErro(null);
    setDesfazendo(id);
    try {
      await api(`/movimentacoes/${id}/estorno`, { method: "POST" });
      setConfirmando(null);
      // O estoque deste aparelho acabou de mudar por uma ação que não passou
      // pela fila local — sem isto, a tela de venda continuaria mostrando o
      // número de antes até a próxima sincronização.
      await baixarCatalogo().catch(() => {});
      // Recarrega a lista inteira em vez de remendar o estado: o estorno é
      // uma linha nova no topo e a original passa a exibir "desfeita" — os
      // dois vêm prontos do servidor.
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível desfazer.");
    } finally {
      setDesfazendo(null);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Histórico de Movimentações</h1>
      <AdminNav />

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <ul className="cartao divide-y divide-gray-200">
        {movimentacoes?.map((mov) => (
          <li key={mov.id} className="py-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className={mov.tipo === "entrada" ? "text-green-700" : "text-red-700"}>
                {ROTULO_TIPO[mov.tipo]} · {ROTULO_MOTIVO[mov.motivo] ?? mov.motivo}
              </span>
              <span className="text-gray-500 whitespace-nowrap">
                {new Date(mov.criadoEm).toLocaleString("pt-BR")}
              </span>
            </div>

            <div>
              {mov.produto.nome} — {mov.quantidade} {mov.produto.unidade} — {mov.usuario.nome}
            </div>

            {mov.estornoDe && (
              <p className="text-xs text-gray-500 mt-1">
                Desfaz uma movimentação de{" "}
                {new Date(mov.estornoDe.criadoEm).toLocaleString("pt-BR")}.
              </p>
            )}

            {mov.estorno && (
              <p className="text-xs text-gray-500 mt-1">
                Desfeita em {new Date(mov.estorno.criadoEm).toLocaleString("pt-BR")}.
              </p>
            )}

            {!mov.estorno && !mov.estornoDe && confirmando !== mov.id && (
              <button
                type="button"
                className="text-xs underline text-gray-600 mt-1"
                onClick={() => {
                  setErro(null);
                  setConfirmando(mov.id);
                }}
              >
                Desfazer
              </button>
            )}

            {confirmando === mov.id && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <p className="text-xs mb-2">
                  Desfazer lança uma {ROTULO_TIPO[mov.tipo === "entrada" ? "saida" : "entrada"]}{" "}
                  de {mov.quantidade} {mov.produto.unidade} de {mov.produto.nome}. As duas linhas
                  ficam no histórico.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-xs underline text-red-700"
                    disabled={desfazendo === mov.id}
                    onClick={() => desfazer(mov.id)}
                  >
                    {desfazendo === mov.id ? "Desfazendo..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    className="text-xs underline text-gray-600"
                    onClick={() => setConfirmando(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {movimentacoes?.length === 0 && (
          <li className="py-2 text-sm text-gray-500">Nenhuma movimentação ainda.</li>
        )}
      </ul>
      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Sair
      </Link>
    </div>
  );
}
