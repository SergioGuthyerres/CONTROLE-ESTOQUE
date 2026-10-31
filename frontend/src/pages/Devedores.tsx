import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ErroApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AdminNav } from "../components/AdminNav";
import { IconeConfirmado } from "../components/Icones";

interface DividaEmAberto {
  movimentacaoId: string;
  valor: number;
  pago: number;
  saldo: number;
  criadoEm: string;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  vendidoPor: string;
}

interface Devedor {
  cliente: string;
  total: number;
  desde: string;
  dividas: DividaEmAberto[];
}

interface ListaDeDevedores {
  devedores: Devedor[];
  total: number;
}

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// O caderno de fiado, na tela: quem levou e ainda não pagou.
//
// Todo mundo entra aqui, funcionário incluído — cobrar fiado é trabalho de
// balcão, e exigir o admin obrigaria a dona da loja a estar presente para
// receber R$ 20. Quando quem abre é admin, a navegação do painel aparece
// junto, porque para ele esta tela é uma das do painel.
//
// Ao contrário da tela de venda, esta NÃO funciona offline, de propósito:
// registrar pagamento é dizer que um dinheiro entrou. Se dois aparelhos
// registrassem o mesmo pagamento offline, os dois achariam que receberam.
export function Devedores() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<ListaDeDevedores | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [recebendoDe, setRecebendoDe] = useState<string | null>(null);
  const [quanto, setQuanto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setLista(await api<ListaDeDevedores>("/fiado/devedores"));
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar a lista. Esta tela precisa de internet.",
      );
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirRecebimento(devedor: Devedor) {
    setErro(null);
    setSucesso(null);
    setRecebendoDe(devedor.cliente);
    // Já vem preenchido com o total: quem paga tudo — o caso mais comum —
    // não digita nada, e quem paga parte apaga e escreve o que recebeu.
    setQuanto(devedor.total.toFixed(2).replace(".", ","));
  }

  async function receber(devedor: Devedor) {
    const valor = Number(quanto.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Escreva quanto a pessoa pagou.");
      return;
    }
    if (valor > devedor.total) {
      setErro(
        `${devedor.cliente} deve ${reais(devedor.total)}. Não dá para registrar um pagamento maior do que a dívida.`,
      );
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const resposta = await api<{ cliente: string; pago: number; restante: number }>(
        "/fiado/pagamentos",
        { method: "POST", body: JSON.stringify({ cliente: devedor.cliente, valor }) },
      );
      setRecebendoDe(null);
      setQuanto("");
      // Recarrega em vez de remendar o estado local: outra pessoa pode ter
      // recebido algo no mesmo minuto, e a lista precisa refletir o que o
      // servidor tem, não o que este aparelho imagina.
      await carregar();
      setSucesso(
        resposta.restante > 0
          ? `${resposta.cliente} pagou ${reais(resposta.pago)}. Ainda deve ${reais(resposta.restante)}.`
          : `${resposta.cliente} pagou ${reais(resposta.pago)} e quitou tudo.`,
      );
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível registrar o pagamento.");
      await carregar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Fiado — quem ainda deve</h1>
      {usuario?.perfil === "admin" && <AdminNav />}

      {erro && (
        <p role="alert" className="cartao border-red-200 bg-red-50 text-sm text-red-700">
          {erro}
        </p>
      )}
      {sucesso && (
        <p
          role="status"
          className="cartao flex items-center gap-3 border-green-200 bg-green-50 text-sm font-semibold text-green-800"
        >
          <IconeConfirmado className="h-5 w-5" />
          <span>{sucesso}</span>
        </p>
      )}
      {!erro && lista === null && <p className="text-sm text-gray-500">Carregando...</p>}

      {lista && lista.devedores.length > 0 && (
        <div className="cartao">
          <div className="text-sm text-gray-500">Total a receber</div>
          <div className="text-3xl font-bold text-amber-700">{reais(lista.total)}</div>
          <div className="text-xs text-gray-500">
            {lista.devedores.length} pessoa{lista.devedores.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {lista?.devedores.length === 0 && (
        <p className="cartao text-sm text-gray-500">Ninguém está devendo.</p>
      )}

      {/* Os mais antigos primeiro: é a dívida esquecida que vira prejuízo. */}
      {lista?.devedores.map((devedor) => {
        const dias = diasDesde(devedor.desde);
        const recebendo = recebendoDe === devedor.cliente;

        return (
          <div key={devedor.cliente} className="cartao space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold break-words">{devedor.cliente}</div>
                <div className="text-xs text-gray-500">
                  Desde {data(devedor.desde)}
                  {dias >= 30 && <span className="text-amber-700"> · há {dias} dias</span>}
                </div>
              </div>
              <div className="text-xl font-bold text-amber-700 whitespace-nowrap">
                {reais(devedor.total)}
              </div>
            </div>

            <ul className="divide-y divide-gray-200 text-sm">
              {devedor.dividas.map((divida) => (
                <li key={divida.movimentacaoId} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0">
                      <span className="break-words">{divida.produtoNome}</span>
                      <span className="text-gray-500">
                        {" "}
                        · {divida.quantidade} {divida.unidade}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-gray-500">
                      {reais(divida.saldo)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {data(divida.criadoEm)} · vendido por {divida.vendidoPor}
                    {divida.pago > 0 && (
                      <span className="text-green-700">
                        {" "}
                        · já pagou {reais(divida.pago)} de {reais(divida.valor)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {recebendo ? (
              <div className="aviso space-y-3">
                <div>
                  <label className="rotulo" htmlFor={`quanto-${devedor.cliente}`}>
                    Quanto {devedor.cliente} pagou agora?
                  </label>
                  <input
                    id={`quanto-${devedor.cliente}`}
                    className="campo"
                    inputMode="decimal"
                    value={quanto}
                    onChange={(e) => setQuanto(e.target.value)}
                    autoFocus
                  />
                  {/* O caderno de fiado não exige pagar tudo de uma vez: o
                      freguês aparece e deixa o que tem. */}
                  <p className="dica">
                    Já vem com o total. Se ele pagou só uma parte, apague e escreva quanto
                    deixou — o resto continua na lista.
                  </p>
                </div>
                <p className="text-xs">Fica registrado com a data, o seu nome e o dele.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="botao-secundario font-semibold text-green-800"
                    disabled={enviando}
                    onClick={() => receber(devedor)}
                  >
                    {enviando ? "Registrando..." : "Registrar pagamento"}
                  </button>
                  <button
                    type="button"
                    className="botao-secundario"
                    disabled={enviando}
                    onClick={() => setRecebendoDe(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="botao-medio w-full text-center bg-compra"
                onClick={() => abrirRecebimento(devedor)}
              >
                Receber pagamento
              </button>
            )}
          </div>
        );
      })}

      <Link to="/" className="botao-voltar block text-center">
        Voltar ao início
      </Link>
    </div>
  );
}
