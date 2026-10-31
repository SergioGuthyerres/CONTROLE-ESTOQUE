import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type FormaPagamento,
  type MotivoMovimentacao,
  type ProdutoLocal,
  type TipoMovimentacao,
} from "../db/db";
import { BuscaProduto } from "../components/BuscaProduto";
import { FORMAS_PAGAMENTO, MOTIVOS_POR_TIPO, ROTULO_MOTIVO } from "../lib/enums";
import { clientesJaUsados } from "../lib/clientes";
import { idDoDispositivo } from "../lib/device";
import { limiteQuantidadeOnlineCache } from "../lib/config";
import { api } from "../lib/api";
import { sincronizarSePossivel } from "../lib/sync";
import { estoqueLocalDeProduto } from "../lib/estoque";

// O título acompanha o MOTIVO, não o tipo. Antes a tela inicial dizia
// "Registrar Venda" e a tela de destino dizia "Registrar Saída" — duas
// palavras para a mesma coisa, e quem usa o sistema sem conhecer o modelo de
// dados por dentro não tem como saber que são a mesma.
function titulo(motivo: MotivoMovimentacao): string {
  return `Registrar ${ROTULO_MOTIVO[motivo]}`;
}

export function TelaMovimentacao({ tipo }: { tipo: TipoMovimentacao }) {
  const navigate = useNavigate();
  const [produto, setProduto] = useState<ProdutoLocal | null>(null);
  const [motivo, setMotivo] = useState<MotivoMovimentacao>(MOTIVOS_POR_TIPO[tipo][0].valor);
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("a_vista");
  const [cliente, setCliente] = useState("");
  const [estoqueLocal, setEstoqueLocal] = useState<number | null>(null);
  const [avisoEstoqueServidor, setAvisoEstoqueServidor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Forma de pagamento só existe em venda: compra, perda e ajuste não têm.
  const ehVenda = tipo === "saida" && motivo === "venda";
  const fiado = ehVenda && formaPagamento === "fiado";

  const clientes = useLiveQuery(clientesJaUsados, [], [] as string[]);

  const limite = limiteQuantidadeOnlineCache();
  const quantidadeNumero = Number(quantidade.replace(",", "."));
  const quantidadeValida = Number.isFinite(quantidadeNumero) && quantidadeNumero > 0;
  const quantidadeGrande = tipo === "saida" && quantidadeNumero > limite;

  // Aviso, não bloqueio. O estoque pode estar atrás da realidade porque a
  // entrada ainda não foi lançada, e travar a venda do balcão por causa disso
  // seria pior do que o número negativo — que o RF10 já sabe apontar depois.
  const deixaNegativo =
    tipo === "saida" &&
    quantidadeValida &&
    estoqueLocal !== null &&
    quantidadeNumero > estoqueLocal;

  useEffect(() => {
    if (!produto) {
      setEstoqueLocal(null);
      return;
    }
    estoqueLocalDeProduto(produto).then(setEstoqueLocal);
  }, [produto]);

  // O que ainda falta para poder confirmar. Devolver a frase, e não só um
  // booleano, é o que permite dizer POR QUE o botão está apagado em vez de
  // deixar a pessoa adivinhar.
  function oQueFalta(): string | null {
    if (!produto) return "Escolha o produto.";
    if (!quantidadeValida) return `Falta dizer a quantidade em ${produto.unidade}.`;
    if (fiado && cliente.trim().length < 2) return "Falta o nome de quem levou fiado.";
    return null;
  }

  const faltando = oQueFalta();
  const podeConfirmar = faltando === null && !salvando;

  // Resumo do que o botão vai fazer, na linguagem da loja. Uma confirmação em
  // dois toques seria atrito demais numa ação que acontece dezenas de vezes
  // por dia; dizer em voz alta o que vai ser gravado custa zero toque e
  // resolve o mesmo problema — ninguém confirma no escuro.
  function resumo(): string {
    if (!produto || !quantidadeValida) return "Confirmar";
    const comoPago = ehVenda ? (fiado ? " fiado" : " à vista") : "";
    const acao = ROTULO_MOTIVO[motivo].toLocaleLowerCase("pt-BR");
    return `Confirmar ${acao}${comoPago}: ${quantidadeNumero} ${produto.unidade} de ${produto.nome}`;
  }

  function escolherProduto(p: ProdutoLocal) {
    setProduto(p);
    setAvisoEstoqueServidor(null);
    setErro(null);
  }

  async function confirmar() {
    const pendencia = oQueFalta();
    if (pendencia) {
      setErro(pendencia);
      return;
    }

    setErro(null);
    setSalvando(true);
    try {
      // RF07: saída grande exige internet — o app confere o estoque real no
      // servidor antes de deixar salvar, porque é aí que um número
      // desatualizado pesa mais (docs/documento-de-visao.md, seção 5.2).
      if (quantidadeGrande) {
        if (!navigator.onLine) {
          setErro(
            `Essa quantidade (acima de ${limite}) exige internet para confirmar. Conecte e tente de novo.`,
          );
          return;
        }
        const resposta = await api<{ estoqueAtual: number }>(`/produtos/${produto!.id}/estoque`);
        setAvisoEstoqueServidor(
          `Estoque no sistema no momento: ${resposta.estoqueAtual} ${produto!.unidade}.`,
        );
      }

      await db.movimentacoes.add({
        id: crypto.randomUUID(),
        produtoId: produto!.id,
        produtoNome: produto!.nome,
        tipo,
        motivo,
        quantidade: quantidadeNumero,
        valor: Number(valor.replace(",", ".")) || 0,
        origemDispositivo: idDoDispositivo(),
        criadoEm: new Date().toISOString(),
        sincronizada: 0,
        ...(ehVenda ? { formaPagamento } : {}),
        ...(fiado ? { cliente: cliente.trim() } : {}),
      });

      sincronizarSePossivel(); // dispara em segundo plano, não trava a tela

      navigate("/", {
        state: {
          sucesso: `${ROTULO_MOTIVO[motivo]} registrada: ${quantidadeNumero} ${produto!.unidade} de ${produto!.nome}.`,
        },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">{titulo(motivo)}</h1>

      {!produto && (
        <div className="cartao space-y-3">
          <label className="rotulo">
            1. Qual produto {tipo === "entrada" ? "chegou" : "saiu"}?
          </label>
          <BuscaProduto onEscolher={escolherProduto} tipo={tipo} />
        </div>
      )}

      {produto && (
        <>
          {/* Passo concluído, em verde: dá para saber de relance que a
              escolha pegou, e qual foi. */}
          <div className="selecionado">
            <span className="min-w-0">
              <span className="block text-xs text-gray-500">1. Produto escolhido</span>
              <span className="block font-semibold text-green-800 break-words">
                {produto.nome}
              </span>
              <span className="block text-xs text-gray-500">
                {produto.categoriaNome}
                {estoqueLocal !== null &&
                  ` · estoque conhecido: ${estoqueLocal} ${produto.unidade}`}
              </span>
            </span>
            <button
              type="button"
              className="botao-secundario shrink-0 py-2"
              onClick={() => setProduto(null)}
            >
              Trocar
            </button>
          </div>

          <div className="cartao space-y-4">
            <div>
              <label className="rotulo" htmlFor="mov-motivo">
                2. Motivo
              </label>
              <select
                id="mov-motivo"
                className="campo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoMovimentacao)}
              >
                {MOTIVOS_POR_TIPO[tipo].map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="rotulo" htmlFor="mov-quantidade">
                3. Quantidade em {produto.unidade}
              </label>
              <input
                id="mov-quantidade"
                className="campo"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                autoFocus
              />
              {quantidadeGrande && (
                <p className="aviso mt-2">
                  Quantidade acima de {limite}: vai precisar de internet para confirmar.
                </p>
              )}
              {deixaNegativo && (
                <p className="aviso mt-2">
                  Isso é mais do que o estoque conhecido ({estoqueLocal} {produto.unidade}). Pode
                  faltar lançar uma entrada — confira antes de confirmar.
                </p>
              )}
            </div>

            <div>
              <label className="rotulo" htmlFor="mov-valor">
                4. Valor total (R$)
              </label>
              <input
                id="mov-valor"
                className="campo"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
              {/* Trocar total por preço unitário é o erro silencioso deste
                  campo: o número entra, nada reclama, e o relatório do mês
                  sai errado. */}
              <p className="dica">
                O valor da operação inteira, não o preço por {produto.unidade}.
              </p>
            </div>

            {ehVenda && (
              <div>
                <label className="rotulo">5. Como foi pago?</label>
                <div className="flex gap-2">
                  {FORMAS_PAGAMENTO.map((opcao) => {
                    const marcada = formaPagamento === opcao.valor;
                    return (
                      <button
                        key={opcao.valor}
                        type="button"
                        aria-pressed={marcada}
                        onClick={() => setFormaPagamento(opcao.valor)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3.5 text-base ${
                          marcada
                            ? "border-transparent bg-marca font-bold text-white"
                            : "border-gray-300 bg-superficie text-gray-700"
                        }`}
                      >
                        {marcada && <span aria-hidden="true">✓</span>}
                        {opcao.rotulo}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fiado && (
              <div>
                <label className="rotulo" htmlFor="cliente">
                  6. Quem levou
                </label>
                {/* datalist e não select: o nome é digitado no balcão, e
                    obrigar cadastro de cliente antes da venda seria atrito na
                    hora errada. A lista sugere quem já levou fiado antes,
                    para o mesmo freguês não virar três nomes diferentes na
                    lista de devedores. */}
                <input
                  id="cliente"
                  className="campo"
                  list="clientes-conhecidos"
                  autoComplete="off"
                  placeholder="Nome de quem levou"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                />
                <datalist id="clientes-conhecidos">
                  {clientes.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
                <p className="dica">
                  Se já levou fiado antes, escolha o nome da lista — assim a dívida dele não
                  aparece dividida em dois nomes parecidos.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {avisoEstoqueServidor && <p className="aviso">{avisoEstoqueServidor}</p>}
      {erro && (
        <p role="alert" className="cartao border-red-200 bg-red-50 text-sm text-red-700">
          {erro}
        </p>
      )}

      {produto && (
        <div className="space-y-2">
          <button
            className="botao-grande text-base leading-snug"
            onClick={confirmar}
            disabled={!podeConfirmar}
          >
            {salvando ? "Salvando..." : resumo()}
          </button>
          {faltando && !salvando && <p className="dica text-center">{faltando}</p>}
        </div>
      )}

      <Link to="/" className="botao-voltar block text-center">
        Voltar ao início
      </Link>
    </div>
  );
}
