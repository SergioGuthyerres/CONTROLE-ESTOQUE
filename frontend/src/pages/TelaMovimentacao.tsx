import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, type MotivoMovimentacao, type ProdutoLocal, type TipoMovimentacao } from "../db/db";
import { BuscaProduto } from "../components/BuscaProduto";
import { MOTIVOS_POR_TIPO } from "../lib/enums";
import { idDoDispositivo } from "../lib/device";
import { limiteQuantidadeOnlineCache } from "../lib/config";
import { api } from "../lib/api";
import { sincronizarSePossivel } from "../lib/sync";
import { estoqueLocalDeProduto } from "../lib/estoque";

const TITULOS: Record<TipoMovimentacao, string> = { entrada: "Registrar Entrada", saida: "Registrar Saída" };

export function TelaMovimentacao({ tipo }: { tipo: TipoMovimentacao }) {
  const navigate = useNavigate();
  const [produto, setProduto] = useState<ProdutoLocal | null>(null);
  const [motivo, setMotivo] = useState<MotivoMovimentacao>(MOTIVOS_POR_TIPO[tipo][0].valor);
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [avisoEstoqueServidor, setAvisoEstoqueServidor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const limite = limiteQuantidadeOnlineCache();
  const quantidadeNumero = Number(quantidade.replace(",", "."));
  const quantidadeGrande = tipo === "saida" && quantidadeNumero > limite;

  function escolherProduto(p: ProdutoLocal) {
    setProduto(p);
    setAvisoEstoqueServidor(null);
    setErro(null);
  }

  async function confirmar() {
    if (!produto || !quantidadeNumero || quantidadeNumero <= 0) {
      setErro("Escolha um produto e informe uma quantidade válida.");
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
            `Essa quantidade (acima de ${limite}) exige internet para confirmar. Conecte e tente de novo.`
          );
          return;
        }
        const resposta = await api<{ estoqueAtual: number }>(`/produtos/${produto.id}/estoque`);
        setAvisoEstoqueServidor(`Estoque no sistema no momento: ${resposta.estoqueAtual} ${produto.unidade}.`);
      }

      await db.movimentacoes.add({
        id: crypto.randomUUID(),
        produtoId: produto.id,
        produtoNome: produto.nome,
        tipo,
        motivo,
        quantidade: quantidadeNumero,
        valor: Number(valor.replace(",", ".")) || 0,
        origemDispositivo: idDoDispositivo(),
        criadoEm: new Date().toISOString(),
        sincronizada: 0,
      });

      sincronizarSePossivel(); // dispara em segundo plano, não trava a tela

      navigate("/", { state: { sucesso: `${TITULOS[tipo]} registrada.` } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">{TITULOS[tipo]}</h1>

      {!produto && <BuscaProduto onEscolher={escolherProduto} />}

      {produto && (
        <ProdutoEscolhido
          produto={produto}
          onTrocar={() => setProduto(null)}
          motivo={motivo}
          onMotivoChange={setMotivo}
          tipo={tipo}
          quantidade={quantidade}
          onQuantidadeChange={setQuantidade}
          valor={valor}
          onValorChange={setValor}
          quantidadeGrande={quantidadeGrande}
          limite={limite}
        />
      )}

      {avisoEstoqueServidor && (
        <p className="text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-3">{avisoEstoqueServidor}</p>
      )}
      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      {produto && (
        <button className="botao-grande" onClick={confirmar} disabled={salvando}>
          {salvando ? "Salvando..." : "Confirmar"}
        </button>
      )}
    </div>
  );
}

function ProdutoEscolhido(props: {
  produto: ProdutoLocal;
  onTrocar: () => void;
  motivo: MotivoMovimentacao;
  onMotivoChange: (m: MotivoMovimentacao) => void;
  tipo: TipoMovimentacao;
  quantidade: string;
  onQuantidadeChange: (v: string) => void;
  valor: string;
  onValorChange: (v: string) => void;
  quantidadeGrande: boolean;
  limite: number;
}) {
  const [estoqueLocal, setEstoqueLocal] = useState<number | null>(null);

  useEffect(() => {
    estoqueLocalDeProduto(props.produto).then(setEstoqueLocal);
  }, [props.produto]);

  return (
    <div className="cartao space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{props.produto.nome}</div>
          <div className="text-sm text-gray-500">
            {props.produto.categoriaNome}
            {estoqueLocal !== null && ` · estoque conhecido: ${estoqueLocal} ${props.produto.unidade}`}
          </div>
        </div>
        <button type="button" className="text-sm underline" onClick={props.onTrocar}>
          Trocar
        </button>
      </div>

      <div>
        <label className="block text-sm mb-1">Motivo</label>
        <select
          className="campo"
          value={props.motivo}
          onChange={(e) => props.onMotivoChange(e.target.value as MotivoMovimentacao)}
        >
          {MOTIVOS_POR_TIPO[props.tipo].map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Quantidade ({props.produto.unidade})</label>
        <input
          className="campo"
          inputMode="decimal"
          value={props.quantidade}
          onChange={(e) => props.onQuantidadeChange(e.target.value)}
          autoFocus
        />
        {props.quantidadeGrande && (
          <p className="text-sm text-amber-700 mt-1">
            Quantidade acima de {props.limite}: vai precisar de internet pra confirmar.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1">Valor total (R$)</label>
        <input
          className="campo"
          inputMode="decimal"
          value={props.valor}
          onChange={(e) => props.onValorChange(e.target.value)}
        />
      </div>
    </div>
  );
}
