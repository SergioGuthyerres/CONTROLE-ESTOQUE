import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ProdutoLocal, type Unidade } from "../db/db";
import { api, ErroApi } from "../lib/api";
import { baixarCatalogo } from "../lib/sync";
import { Link } from "react-router-dom";
import { UNIDADES } from "../lib/enums";
import { IconeConfirmado } from "../components/Icones";

// O que o servidor responde em GET /produtos/:id/vinculos. A contagem e o
// texto do aviso vêm de lá de propósito: a mesma regra que decide se apaga ou
// arquiva é a que escreve a frase. Tela e servidor dizendo coisas diferentes
// sobre a mesma operação é como se aprende a não ler o aviso.
interface VinculosDoProduto {
  produtoId: string;
  nome: string;
  movimentacoes: number;
  acao: "excluir" | "arquivar";
  aviso: string;
}

interface ProdutoArquivado {
  id: string;
  nome: string;
  unidade: string;
  categoria: { nome: string };
}

// Cadastro e manutenção do catálogo.
//
// A tela nasceu só com o formulário, e por isso não havia como corrigir um
// cadastro errado: o jeito era deixar o duplicado lá. Em dois meses o
// catálogo foi de 46 para 303 produtos, e a lista de venda virou um campo
// minado de nomes parecidos — que é exatamente o tipo de erro que o RNF05
// manda evitar. Agora a tela tem as duas metades: cadastrar e arrumar.
export function CadastroProduto() {
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("kg");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState<VinculosDoProduto | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const [arquivados, setArquivados] = useState<ProdutoArquivado[] | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);

  const categorias = useLiveQuery(() => db.categorias.orderBy("nome").toArray(), []);
  const produtos = useLiveQuery(() => db.produtos.orderBy("nome").toArray(), []);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const combina = (texto: string) =>
    termo ? texto.toLocaleLowerCase("pt-BR").includes(termo) : true;

  const emUso = (produtos ?? []).filter((p) => combina(p.nome));
  const fora = (arquivados ?? []).filter((p) => combina(p.nome));

  // Cadastrar, remover e arquivar passam pelo servidor. Dizer isso antes do
  // toque evita a mensagem de erro depois — e o botão desabilitado com a
  // explicação ao lado é mais honesto que um botão que falha.
  const online = navigator.onLine;
  const podeSalvar = nome.trim().length > 0 && categoriaId !== "" && online && !salvando;

  function limparRecados() {
    setErro(null);
    setSucesso(null);
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    limparRecados();

    if (!nome.trim() || !categoriaId) {
      setErro("Preencha o nome e escolha a categoria.");
      return;
    }
    if (!navigator.onLine) {
      setErro("Sem internet agora — cadastrar produto precisa de conexão.");
      return;
    }

    const nomeSalvo = nome.trim();
    setSalvando(true);
    try {
      await api("/produtos", {
        method: "POST",
        body: JSON.stringify({
          nome: nomeSalvo,
          categoriaId,
          unidade,
          estoqueMinimo: Number(estoqueMinimo.replace(",", ".")) || 0,
        }),
      });
      await baixarCatalogo();
      setNome("");
      setEstoqueMinimo("");
      setSucesso(`"${nomeSalvo}" foi cadastrado.`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  // Perguntar não pode ter efeito nenhum: esta rota só conta. A remoção só
  // acontece no "Confirmar", depois que a pessoa leu o número real.
  async function pedirConfirmacao(produto: ProdutoLocal) {
    limparRecados();
    try {
      setConfirmando(await api<VinculosDoProduto>(`/produtos/${produto.id}/vinculos`));
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível conferir o histórico do produto.",
      );
    }
  }

  async function confirmarRemocao() {
    if (!confirmando) return;
    limparRecados();
    setRemovendo(true);

    const { produtoId, nome: nomeRemovido, acao } = confirmando;
    try {
      if (acao === "excluir") {
        await api(`/produtos/${produtoId}`, { method: "DELETE" });
      } else {
        await api(`/produtos/${produtoId}/arquivar`, { method: "POST" });
      }
      setConfirmando(null);
      // O produto arquivado some da resposta de /produtos, e baixarCatalogo
      // apaga daqui o que não veio — é assim que ele some da tela de venda
      // deste aparelho sem nenhuma rota extra.
      await baixarCatalogo();
      if (arquivados !== null) await carregarArquivados();
      setSucesso(
        acao === "excluir"
          ? `"${nomeRemovido}" foi apagado do cadastro.`
          : `"${nomeRemovido}" foi arquivado. O histórico dele continua nos relatórios.`,
      );
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível remover o produto.");
    } finally {
      setRemovendo(false);
    }
  }

  async function carregarArquivados() {
    try {
      setArquivados(await api<ProdutoArquivado[]>("/produtos?arquivados=true"));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar os arquivados.");
    }
  }

  async function desarquivar(produto: ProdutoArquivado) {
    limparRecados();
    try {
      await api(`/produtos/${produto.id}/desarquivar`, { method: "POST" });
      await baixarCatalogo();
      await carregarArquivados();
      setSucesso(`"${produto.nome}" voltou para o cadastro.`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível desarquivar.");
    }
  }

  if (categorias && categorias.length === 0) {
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-lg font-semibold">Produtos</h1>
        <div className="cartao space-y-3">
          <p className="text-gray-700">
            Todo produto pertence a uma categoria, e ainda não existe nenhuma cadastrada.
          </p>
          <Link to="/categorias" className="botao-medio inline-block text-center">
            Cadastrar categoria
          </Link>
        </div>
        <Link to="/" className="botao-voltar block text-center">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Produtos</h1>

      {/* Os recados ficam no topo, um só de cada vez, para não competirem
          com o conteúdo nem empurrarem a tela para baixo enquanto se digita. */}
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
      {!online && (
        <p className="cartao border-gray-200 bg-fundo text-sm text-gray-600">
          Sem internet. Dá para consultar a lista, mas cadastrar e remover precisam de conexão.
        </p>
      )}

      <form onSubmit={aoEnviar} className="cartao space-y-4">
        <h2 className="font-semibold">Cadastrar produto</h2>

        <div>
          <label className="rotulo" htmlFor="produto-nome">
            Nome
          </label>
          <input
            id="produto-nome"
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Ração para cachorro 15 kg"
          />
          <p className="dica">
            Use o nome como ele é pedido no balcão. Confira na lista abaixo se já existe
            parecido, para não criar duplicado.
          </p>
        </div>

        <div>
          <label className="rotulo" htmlFor="produto-categoria">
            Categoria
          </label>
          <select
            id="produto-categoria"
            className="campo"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor="produto-unidade">
            Unidade
          </label>
          <select
            id="produto-unidade"
            className="campo"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as Unidade)}
          >
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor="produto-minimo">
            Estoque mínimo
          </label>
          <input
            id="produto-minimo"
            className="campo"
            inputMode="decimal"
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
            placeholder="0"
          />
          <p className="dica">
            Quando o estoque cair abaixo desse número, o produto aparece nos alertas. Deixe 0
            se não quiser aviso.
          </p>
        </div>

        <button className="botao-grande" disabled={!podeSalvar}>
          {salvando ? "Salvando..." : "Cadastrar produto"}
        </button>
        {!podeSalvar && !salvando && online && (
          <p className="dica text-center">
            Preencha o nome e escolha a categoria para liberar o botão.
          </p>
        )}
      </form>

      <div className="cartao space-y-4">
        <h2 className="font-semibold">Produtos cadastrados</h2>

        <div>
          <label className="rotulo" htmlFor="produto-busca">
            Procurar
          </label>
          <input
            id="produto-busca"
            className="campo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite parte do nome"
          />
        </div>

        {/* Arquivados como filtro da mesma lista, e não num cartão à parte:
            são a mesma coisa vista de outro jeito, e empilhar um terceiro
            bloco só fazia a tela crescer. */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={!verArquivados}
            onClick={() => {
              setVerArquivados(false);
              setConfirmando(null);
            }}
          >
            Em uso{produtos ? ` (${produtos.length})` : ""}
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={verArquivados}
            disabled={!online}
            onClick={() => {
              setVerArquivados(true);
              setConfirmando(null);
              if (arquivados === null) carregarArquivados();
            }}
          >
            Arquivados{arquivados ? ` (${arquivados.length})` : ""}
          </button>
        </div>

        {verArquivados ? (
          <>
            <p className="dica">
              Produtos que saíram das telas de venda e compra. O histórico e os relatórios deles
              continuam inteiros, e dá para trazer de volta a qualquer momento.
            </p>
            {arquivados === null && <p className="text-sm text-gray-500">Carregando...</p>}
            {arquivados !== null && fora.length === 0 && (
              <p className="text-sm text-gray-500">
                {termo ? "Nenhum arquivado com esse nome." : "Nenhum produto arquivado."}
              </p>
            )}
            <ul className="divide-y divide-gray-200">
              {fora.map((produto) => (
                <li
                  key={produto.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="break-words font-medium">{produto.nome}</div>
                    <div className="text-xs text-gray-500">
                      {produto.categoria.nome} · {produto.unidade}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="botao-secundario shrink-0 py-2"
                    disabled={!online}
                    onClick={() => desarquivar(produto)}
                  >
                    Desarquivar
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {produtos === undefined && <p className="text-sm text-gray-500">Carregando...</p>}
            {produtos && emUso.length === 0 && (
              <p className="text-sm text-gray-500">
                {termo ? "Nenhum produto com esse nome." : "Nenhum produto cadastrado ainda."}
              </p>
            )}
            <ul className="divide-y divide-gray-200">
              {emUso.map((produto) => (
                <li key={produto.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{produto.nome}</div>
                      <div className="text-xs text-gray-500">
                        {produto.categoriaNome} · {produto.unidade} · estoque{" "}
                        {produto.estoqueAtualServidor} {produto.unidade}
                      </div>
                    </div>
                    {confirmando?.produtoId !== produto.id && (
                      <button
                        type="button"
                        className="botao-secundario shrink-0 py-2 text-red-700 disabled:opacity-40"
                        disabled={!online || confirmando !== null}
                        onClick={() => pedirConfirmacao(produto)}
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  {/* A confirmação nasce colada no produto, e não num diálogo
                      solto no meio da tela: assim não há dúvida sobre QUAL
                      produto está prestes a sair. */}
                  {confirmando?.produtoId === produto.id && (
                    <div className="aviso mt-2 space-y-2">
                      <p>{confirmando.aviso}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="botao-secundario py-2 font-semibold text-red-700"
                          disabled={removendo}
                          onClick={confirmarRemocao}
                        >
                          {removendo
                            ? "Removendo..."
                            : confirmando.acao === "excluir"
                              ? "Apagar"
                              : "Arquivar"}
                        </button>
                        <button
                          type="button"
                          className="botao-secundario py-2"
                          disabled={removendo}
                          onClick={() => setConfirmando(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Link to="/" className="botao-voltar block text-center">
        Voltar ao início
      </Link>
    </div>
  );
}
