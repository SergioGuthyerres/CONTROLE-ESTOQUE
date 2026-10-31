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
  valorFiado: number;
}

interface GrupoResumido {
  movimentacoes: number;
  valorTotal: number;
  valorAVista: number;
  valorFiado: number;
  linhas: LinhaDoResumo[];
}

interface MovimentacaoSuspeita {
  id: string;
  produtoNome: string;
  motivo: string;
  quantidade: number;
  unidade: string;
  valor: number;
  criadoEm: string;
  usuario: string;
}

interface GrupoDeAnomalia {
  codigo: string;
  descricao: string;
  movimentacoes: MovimentacaoSuspeita[];
}

interface ResumoDoPeriodo {
  vendas: GrupoResumido;
  compras: GrupoResumido;
  outras: GrupoResumido;
  // Ausente quando a API é mais antiga que esta versão do app — o PWA se
  // publica sozinho a cada merge e o servidor nem sempre vai junto.
  anomalias?: GrupoDeAnomalia[];
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
              {/* A separação é o ponto: o total sozinho soma dinheiro que
                  ainda não entrou na gaveta, e é com ele que alguém compara o
                  que contou à mão no fim do dia. */}
              <div className="text-xs text-gray-600 mt-1">
                <span className="text-green-700">
                  {reais(resumo.vendas.valorAVista)} à vista
                </span>
                {resumo.vendas.valorFiado > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber-700">
                      {reais(resumo.vendas.valorFiado)} fiado
                    </span>
                  </>
                )}
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

          {/* A trava de verdade está na tela de lançamento. Isto aqui é a
              rede embaixo dela: o PWA se publica sozinho, mas o celular pode
              ficar semanas com o bundle em cache, e um aparelho com versão
              antiga continua gravando sem conhecer as regras novas. Não
              recusa nada — mostra, para o admin corrigir com estorno.
              Decisão registrada em docs/ARCHITECTURE.md. */}
          {resumo.anomalias && resumo.anomalias.length > 0 && (
            <div className="aviso space-y-3">
              <p className="font-semibold">Lançamentos para conferir</p>
              {resumo.anomalias.map((grupo) => (
                <div key={grupo.codigo}>
                  <p className="font-medium">
                    {grupo.movimentacoes.length}{" "}
                    {grupo.movimentacoes.length === 1 ? "lançamento" : "lançamentos"}{" "}
                    {grupo.descricao}
                  </p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {grupo.movimentacoes.map((mov) => (
                      <li key={`${grupo.codigo}-${mov.id}`}>
                        {mov.produtoNome} · {mov.quantidade} {mov.unidade} ·{" "}
                        {reais(mov.valor)} · {ROTULO_MOTIVO[mov.motivo as MotivoMovimentacao] ?? mov.motivo} ·{" "}
                        {mov.usuario} · {new Date(mov.criadoEm).toLocaleString("pt-BR")}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs">
                Para corrigir, desfaça a movimentação no Histórico e lance de novo — nada aqui
                é apagado.
              </p>
            </div>
          )}

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

      <Link to="/" className="botao-voltar block text-center">
        Voltar ao início
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
      <div className="font-semibold mb-2">{props.titulo}</div>
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
              {linha.valorFiado > 0 && (
                <span className="text-amber-700"> ({reais(linha.valorFiado)} fiado)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
