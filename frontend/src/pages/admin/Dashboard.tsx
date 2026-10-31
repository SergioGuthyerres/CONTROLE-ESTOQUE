import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { BotaoVerMais, useExpansivel } from "../../components/ListaExpansivel";

interface Alerta {
  produtoId: string;
  produtoNome: string;
  tipo: "negativo" | "minimo";
  estoqueAtual: number;
}

interface LinhaDeEstoque {
  produtoId: string;
  produtoNome: string;
  unidade: string;
  arquivado: boolean;
  estoqueAtual: number;
  custoMedioUnitario: number;
  valorEstoque: number;
}

interface ResumoDashboard {
  totalProdutos: number;
  valorTotalEstoque: number;
  movimentacoesUltimos30Dias: number;
  alertas: Alerta[];
  // Ausente quando a API é mais antiga que esta versão do app — o PWA se
  // publica sozinho a cada merge e o servidor nem sempre vai junto.
  produtos?: LinhaDeEstoque[];
}

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// RF08 — só funciona online (é o painel do admin, não precisa ser
// offline-first).
export function Dashboard() {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    api<ResumoDashboard>("/dashboard")
      .then(setResumo)
      .catch(() => setErro("Não foi possível carregar o painel. Verifique a internet."));
  }, []);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const produtos = useMemo(() => {
    const todos = resumo?.produtos ?? [];
    return termo
      ? todos.filter((p) => p.produtoNome.toLocaleLowerCase("pt-BR").includes(termo))
      : todos;
  }, [resumo, termo]);

  const lista = useExpansivel(produtos.length, 10);

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Painel</h1>
      <AdminNav />

      {erro && (
        <p role="alert" className="cartao border-red-200 bg-red-50 text-sm text-red-700">
          {erro}
        </p>
      )}
      {!erro && resumo === null && <p className="text-sm text-gray-500">Carregando...</p>}

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="cartao">
              <div className="text-sm text-gray-500">Produtos em uso</div>
              <div className="text-2xl font-bold tabular-nums">{resumo.totalProdutos}</div>
            </div>
            <div className="cartao">
              <div className="text-sm text-gray-500">Valor em estoque</div>
              <div className="text-xl font-bold tabular-nums">{reais(resumo.valorTotalEstoque)}</div>
            </div>
            <div className="cartao col-span-2">
              <div className="text-sm text-gray-500">Movimentações (últimos 30 dias)</div>
              <div className="text-2xl font-bold tabular-nums">{resumo.movimentacoesUltimos30Dias}</div>
            </div>
          </div>

          <div className="cartao space-y-2">
            <div className="font-semibold">Alertas ({resumo.alertas.length})</div>
            {resumo.alertas.length === 0 && (
              <p className="text-sm text-gray-500">Nenhum alerta ativo.</p>
            )}
            <ul className="divide-y divide-gray-200">
              {resumo.alertas.map((alerta) => (
                <li key={alerta.produtoId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      alerta.tipo === "negativo"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {alerta.tipo === "negativo" ? "Estoque negativo" : "Estoque mínimo"}
                  </span>
                  <span className="min-w-0 break-words">{alerta.produtoNome}</span>
                  <span className="text-gray-500">— {alerta.estoqueAtual}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* "Quanto eu tenho de cada coisa e quanto isso vale" é a pergunta
              que o painel existe para responder, e ela estava sendo calculada
              no servidor e jogada fora: só o total aparecia. */}
          {resumo.produtos && (
            <div className="cartao space-y-3">
              <div className="font-semibold">Estoque por produto</div>

              <div>
                <label className="rotulo" htmlFor="estoque-busca">
                  Procurar
                </label>
                <input
                  id="estoque-busca"
                  className="campo"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite parte do nome"
                />
              </div>

              {produtos.length === 0 && (
                <p className="text-sm text-gray-500">
                  {termo ? "Nenhum produto com esse nome." : "Nenhum produto com estoque."}
                </p>
              )}

              <ul className="divide-y divide-gray-200">
                {produtos.slice(0, lista.limite).map((linha) => (
                  <li key={linha.produtoId} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block break-words font-medium">
                        {linha.produtoNome}
                        {linha.arquivado && (
                          <span className="text-xs font-normal text-gray-500"> · arquivado</span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {linha.estoqueAtual} {linha.unidade}
                        {linha.custoMedioUnitario > 0 &&
                          ` · ${reais(linha.custoMedioUnitario)} por ${linha.unidade}`}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold">
                      {reais(linha.valorEstoque)}
                    </span>
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

              {/* Sem compra registrada não há custo médio, e o produto
                  aparece valendo zero. Dizer isso evita a conclusão de que o
                  sistema perdeu o valor. */}
              <p className="dica">
                O valor vem do custo médio das compras registradas. Produto que nunca teve
                compra lançada aparece sem valor.
              </p>
            </div>
          )}
        </>
      )}

      <Link to="/" className="botao-voltar block text-center">
        Voltar ao início
      </Link>
    </div>
  );
}
