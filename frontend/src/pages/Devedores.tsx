import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ErroApi } from "../lib/api";

interface DividaEmAberto {
  movimentacaoId: string;
  valor: number;
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
// receber R$ 20.
//
// Ao contrário da tela de venda, esta NÃO funciona offline, de propósito: dar
// baixa é dizer que um dinheiro entrou. Se dois aparelhos baixassem a mesma
// dívida offline, os dois achariam que receberam. O servidor é quem decide,
// e o @unique da tabela é a garantia final.
export function Devedores() {
  const [lista, setLista] = useState<ListaDeDevedores | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

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

  async function darBaixa(chave: string, movimentacaoIds: string[]) {
    setErro(null);
    setBaixando(chave);
    try {
      await api("/fiado/baixas", {
        method: "POST",
        body: JSON.stringify({ movimentacaoIds }),
      });
      setConfirmando(null);
      // Recarrega em vez de remendar o estado local: outra pessoa pode ter
      // baixado outra dívida no mesmo minuto, e a lista precisa refletir o
      // que o servidor tem, não o que este aparelho imagina.
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível dar baixa.");
      await carregar();
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Fiado — quem ainda deve</h1>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}
      {!erro && lista === null && <p className="text-sm text-gray-500">Carregando...</p>}

      {lista && lista.devedores.length > 0 && (
        <div className="cartao">
          <div className="text-sm text-gray-500">Total a receber</div>
          <div className="text-2xl font-semibold text-amber-700">{reais(lista.total)}</div>
          <div className="text-xs text-gray-500">
            {lista.devedores.length} pessoa{lista.devedores.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {lista?.devedores.length === 0 && (
        <p className="cartao text-sm text-gray-500">Ninguém está devendo. 🎉</p>
      )}

      {/* Os mais antigos primeiro: é a dívida esquecida que vira prejuízo. */}
      {lista?.devedores.map((devedor) => {
        const chave = devedor.cliente;
        const ids = devedor.dividas.map((d) => d.movimentacaoId);
        const dias = diasDesde(devedor.desde);

        return (
          <div key={chave} className="cartao space-y-2">
            <div className="flex justify-between gap-2 items-start">
              <div>
                <div className="font-medium">{devedor.cliente}</div>
                <div className="text-xs text-gray-500">
                  Desde {data(devedor.desde)}
                  {dias >= 30 && <span className="text-amber-700"> · há {dias} dias</span>}
                </div>
              </div>
              <div className="text-lg font-semibold text-amber-700 whitespace-nowrap">
                {reais(devedor.total)}
              </div>
            </div>

            <ul className="divide-y divide-gray-200 text-sm">
              {devedor.dividas.map((divida) => (
                <li key={divida.movimentacaoId} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span>
                      {divida.produtoNome}
                      <span className="text-gray-500">
                        {" "}
                        · {divida.quantidade} {divida.unidade}
                      </span>
                    </span>
                    <span className="text-gray-500 whitespace-nowrap">
                      {reais(divida.valor)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {data(divida.criadoEm)} · vendido por {divida.vendidoPor}
                  </div>
                  {devedor.dividas.length > 1 && confirmando === null && (
                    <button
                      type="button"
                      className="text-xs underline text-gray-600 mt-1"
                      onClick={() => setConfirmando(divida.movimentacaoId)}
                    >
                      Pagou só esta
                    </button>
                  )}

                  {confirmando === divida.movimentacaoId && (
                    <ConfirmacaoDeBaixa
                      texto={`Marcar como paga a compra de ${reais(divida.valor)} de ${devedor.cliente}?`}
                      ocupado={baixando === divida.movimentacaoId}
                      aoConfirmar={() =>
                        darBaixa(divida.movimentacaoId, [divida.movimentacaoId])
                      }
                      aoCancelar={() => setConfirmando(null)}
                    />
                  )}
                </li>
              ))}
            </ul>

            {confirmando === null && (
              <button
                type="button"
                className="botao-medio w-full text-center bg-green-700"
                onClick={() => setConfirmando(chave)}
              >
                Dar baixa · {reais(devedor.total)}
              </button>
            )}

            {confirmando === chave && (
              <ConfirmacaoDeBaixa
                texto={`Marcar como pago tudo o que ${devedor.cliente} deve — ${reais(devedor.total)}?`}
                ocupado={baixando === chave}
                aoConfirmar={() => darBaixa(chave, ids)}
                aoCancelar={() => setConfirmando(null)}
              />
            )}
          </div>
        );
      })}

      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Voltar
      </Link>
    </div>
  );
}

// A baixa não tem desfazer: ela é um registro, e registro não se apaga (mesma
// regra do histórico). Por isso a confirmação — e por isso ela diz o valor.
function ConfirmacaoDeBaixa(props: {
  texto: string;
  ocupado: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
      <p className="text-xs mb-2">
        {props.texto} Fica registrado com a data, o seu nome e o nome do devedor.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="text-xs underline text-green-800"
          disabled={props.ocupado}
          onClick={props.aoConfirmar}
        >
          {props.ocupado ? "Dando baixa..." : "Confirmar"}
        </button>
        <button
          type="button"
          className="text-xs underline text-gray-600"
          onClick={props.aoCancelar}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
