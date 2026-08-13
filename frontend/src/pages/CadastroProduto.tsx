import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Unidade } from "../db/db";
import { api, ErroApi } from "../lib/api";
import { baixarCatalogo } from "../lib/sync";
import { Link } from "react-router-dom";
const UNIDADES: Unidade[] = ["kg", "L"];

// Também exige internet (mesma lógica de CadastroCategoria.tsx).
export function CadastroProduto() {
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("kg");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const categorias = useLiveQuery(
    () => db.categorias.orderBy("nome").toArray(),
    [],
  );

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || !categoriaId) {
      setErro("Preencha nome e categoria.");
      return;
    }
    setErro(null);

    if (!navigator.onLine) {
      setErro(
        "Sem internet no momento — cadastro de produto precisa estar online.",
      );
      return;
    }

    setSalvando(true);
    try {
      await api("/produtos", {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          categoriaId,
          unidade,
          estoqueMinimo: Number(estoqueMinimo.replace(",", ".")) || 0,
        }),
      });
      await baixarCatalogo();
      setNome("");
      setEstoqueMinimo("");
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (categorias && categorias.length === 0) {
    return (
      <div className="pt-2">
        <p className="text-gray-600">
          Cadastre uma categoria antes de cadastrar produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Cadastrar Produto</h1>

      <form onSubmit={aoEnviar} className="cartao space-y-3">
        <div>
          <label className="block text-sm mb-1">Nome</label>
          <input
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Categoria</label>
          <select
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
          <label className="block text-sm mb-1">Unidade</label>
          <select
            className="campo"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as Unidade)}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u === "kg" ? "kg (inclui fardo/saco)" : "L"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Estoque mínimo</label>
          <input
            className="campo"
            inputMode="decimal"
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
          />
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button className="botao-grande" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <Link to="/" className="botao-medio block text-center bg-gray-700">
          Sair
        </Link>
      </form>
    </div>
  );
}
