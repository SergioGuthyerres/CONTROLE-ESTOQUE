import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ErroApi } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { ROTULO_MOTIVO, ROTULO_TIPO } from "../../lib/enums";
import { fimDoDiaLocal, hoje, inicioDoDiaLocal, somarDias } from "../../lib/datas";
import type { MotivoMovimentacao, TipoMovimentacao } from "../../db/db";

interface LinhaDoResumo {
  produtoId: string;
  produtoNome: string;
  unidade: string;
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  valor: number;
  movimentacoes: number;
}

interface GrupoResumido {
  movimentacoes: number;
  valorTotal: number;
  linhas: LinhaDoResumo[];
}

interface ResumoDoPeriodo {
  vendas: GrupoResumido;
  compras: GrupoResumido;
  outras: GrupoResumido;
}

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// A pergunta do fim do expediente: "quanto vendemos hoje, quanto compramos, e
// o que mais mexeu no estoque?". O histórico responde isso em 50 linhas
// cronológicas; aqui a resposta são três números e o que girou em cada um.
export function ResumoDoDia() {
  const [dia, setDia] = useState(hoje());
  const [resumo, setResumo] = useState<ResumoDoPeriodo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!dia) return;
    const parametros = new URLSearchParams({
      // O navegador converte o dia no fuso da loja — ver src/lib/datas.ts.
      dataInicio: inicioDoDiaLocal(dia).toISOString(),
      dataFim: fimDoDiaLocal(dia).toISOString(),
    });
    try {
      setErro(null);
      setResumo(null);
      setResumo(await api<ResumoDoPeriodo>(`/relatorios/resumo-do-dia?${parametros}`));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o resumo.");
    }
  }, [dia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Resumo do Dia</h1>
      <AdminNav />

      <div className="cartao space-y-2">
        <label className="block text-sm">Dia</label>
        <input
          type="date"
          className="campo"
          value={dia}
          max={hoje()}
          onChange={(e) => setDia(e.target.value)}
        />
        <div className="flex gap-4 text-xs">
          <button type="button" className="underline" onClick={() => setDia(hoje())}>
            Hoje
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => setDia(somarDias(hoje(), -1))}
          >
            Ontem
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => setDia(somarDias(dia, -1))}
          >
            ‹ Dia anterior
          </button>
          <button
            type="button"
            className="underline disabled:text-gray-300 disabled:no-underline"
            disabled={dia >= hoje()}
            onClick={() => setDia(somarDias(dia, 1))}
          >
            Dia seguinte ›
          </button>
        </div>
      </div>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}
      {!erro && resumo === null && <p className="text-sm text-gray-500">Carregando...</p>}

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="cartao">
              <div className="text-sm text-gray-500">Vendas</div>
              <div className="text-2xl font-semibold text-red-700">
                {reais(resumo.vendas.valorTotal)}
              </div>
              <div className="text-xs text-gray-500">
                {resumo.vendas.movimentacoes} movimentação
                {resumo.vendas.movimentacoes === 1 ? "" : "s"}
              </div>
            </div>
            <div className="cartao">
              <div className="text-sm text-gray-500">Compras</div>
              <div className="text-2xl font-semibold text-green-700">
                {reais(resumo.compras.valorTotal)}
              </div>
              <div className="text-xs text-gray-500">
                {resumo.compras.movimentacoes} movimentação
                {resumo.compras.movimentacoes === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <Grupo titulo="Vendas do dia" grupo={resumo.vendas} vazio="Nenhuma venda neste dia." />
          <Grupo
            titulo="Compras do dia"
            grupo={resumo.compras}
            vazio="Nenhuma compra neste dia."
          />
          <Grupo
            titulo="Outras movimentações"
            grupo={resumo.outras}
            vazio="Nenhuma perda, ajuste ou estorno neste dia."
            mostrarMotivo
          />
        </>
      )}

      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Sair
      </Link>
    </div>
  );
}

function Grupo(props: {
  titulo: string;
  grupo: GrupoResumido;
  vazio: string;
  mostrarMotivo?: boolean;
}) {
  return (
    <div className="cartao">
      <div className="font-medium mb-2">{props.titulo}</div>
      {props.grupo.linhas.length === 0 && <p className="text-sm text-gray-500">{props.vazio}</p>}
      <ul className="divide-y divide-gray-200">
        {props.grupo.linhas.map((linha) => (
          <li
            key={`${linha.produtoId}-${linha.tipo}-${linha.motivo}`}
            className="py-2 text-sm flex justify-between gap-2"
          >
            <span>
              {linha.produtoNome}
              {props.mostrarMotivo && (
                <span className="text-gray-500">
                  {" "}
                  · {ROTULO_TIPO[linha.tipo]} · {ROTULO_MOTIVO[linha.motivo]}
                </span>
              )}
            </span>
            <span className="text-gray-500 whitespace-nowrap">
              {linha.quantidade} {linha.unidade}
              {linha.valor > 0 && ` · ${reais(linha.valor)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
