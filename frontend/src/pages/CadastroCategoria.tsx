import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { api, ErroApi } from "../lib/api";
import { baixarCatalogo } from "../lib/sync";

// Cadastro de categoria exige internet — é uma ação rara (não é o dia a dia
// como entrada/saída), então não vale a complexidade de fazer offline.
export function CadastroCategoria() {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const categorias = useLiveQuery(() => db.categorias.orderBy("nome").toArray(), []);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setErro(null);

    if (!navigator.onLine) {
      setErro("Sem internet no momento — cadastro de categoria precisa estar online.");
      return;
    }

    setSalvando(true);
    try {
      await api("/categorias", { method: "POST", body: JSON.stringify({ nome: nome.trim() }) });
      await baixarCatalogo();
      setNome("");
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Cadastrar Categoria</h1>

      <form onSubmit={aoEnviar} className="cartao space-y-3">
        <input
          className="campo"
          placeholder="Nome da categoria"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        <button className="botao-grande" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <ul className="cartao divide-y divide-gray-200">
        {categorias?.map((c) => (
          <li key={c.id} className="py-2">
            {c.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
