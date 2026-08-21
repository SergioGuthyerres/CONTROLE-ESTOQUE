import { useCallback, useEffect, useState } from "react";
import { api, ErroApi } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { Link } from "react-router-dom";
import {
  PERIODO_VAZIO,
  SeletorDePeriodo,
  parametrosDoPeriodo,
  periodoInvertido,
  type Periodo,
} from "../../components/SeletorDePeriodo";

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

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function descreverPeriodo(periodo: Periodo): string {
  const formatar = (dia: string) => new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR");
  if (!periodo.de && !periodo.ate) return "todo o histórico";
  if (periodo.de && !periodo.ate) return `de ${formatar(periodo.de)} em diante`;
  if (!periodo.de && periodo.ate) return `até ${formatar(periodo.ate)}`;
  if (periodo.de === periodo.ate) return formatar(periodo.de);
  return `${formatar(periodo.de)} a ${formatar(periodo.ate)}`;
}

// RF11 + RF12.
export function Relatorios() {
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_VAZIO);
  const [maisMovimentados, setMaisMovimentados] = useState<LinhaMovimentacao[] | null>(null);
  const [valorEstoque, setValorEstoque] = useState<{
    linhas: LinhaValor[];
    valorTotal: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const invertido = periodoInvertido(periodo);

  // Só este relatório responde ao período. O de valor em estoque é uma foto do
  // agora: o estoque atual não tem versão "em 12 de agosto" — reconstruí-lo
  // exigiria refazer a soma das movimentações até aquela data, e ninguém pediu
  // isso. Melhor deixar explícito na tela do que devolver um número que
  // parece ser de um período e não é.
  const carregarMovimentados = useCallback(async () => {
    if (periodoInvertido(periodo)) return;
    const consulta = parametrosDoPeriodo(periodo).toString();
    try {
      setErro(null);
      setMaisMovimentados(null);
      setMaisMovimentados(
        await api<LinhaMovimentacao[]>(
          `/relatorios/movimentacao-por-produto${consulta ? `?${consulta}` : ""}`,
        ),
      );
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o relatório.");
    }
  }, [periodo]);

  useEffect(() => {
    carregarMovimentados();
  }, [carregarMovimentados]);

  useEffect(() => {
    api<{ linhas: LinhaValor[]; valorTotal: number }>("/relatorios/valor-total-estoque")
      .then(setValorEstoque)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Relatórios</h1>
      <AdminNav />

      <div className="cartao">
        <SeletorDePeriodo
          valor={periodo}
          aoMudar={setPeriodo}
          mostrarDias={false}
          atalhosEmDias={[7, 30, 90]}
        />
      </div>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="cartao">
        <div className="font-medium">Produtos mais movimentados</div>
        <div className="text-xs text-gray-500 mb-2">{descreverPeriodo(periodo)}</div>

        {invertido && <p className="text-sm text-gray-500">Corrija o período para ver o resultado.</p>}
        {!invertido && maisMovimentados === null && (
          <p className="text-sm text-gray-500">Carregando...</p>
        )}
        {maisMovimentados?.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma movimentação neste período.</p>
        )}

        <ol className="divide-y divide-gray-200">
          {maisMovimentados?.map((linha, indice) => (
            <li key={linha.produtoId} className="py-2 text-sm flex justify-between">
              <span>
                {indice + 1}. {linha.produtoNome}
              </span>
              <span className="text-gray-500">{linha.totalMovimentado}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="cartao">
        <div className="font-medium">Valor total em estoque</div>
        <div className="text-xs text-gray-500 mb-1">
          Foto de agora — não muda com o período escolhido acima.
        </div>
        <div className="text-2xl font-semibold mb-2">
          {valorEstoque ? reais(valorEstoque.valorTotal) : "—"}
        </div>
        <ul className="divide-y divide-gray-200">
          {valorEstoque?.linhas.map((linha) => (
            <li key={linha.produtoId} className="py-2 text-sm flex justify-between">
              <span>{linha.produtoNome}</span>
              <span className="text-gray-500">{reais(linha.valorEstoque)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Sair
      </Link>
    </div>
  );
}
