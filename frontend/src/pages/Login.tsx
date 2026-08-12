import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ErroApi } from "../lib/api";

export function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(nome, senha);
      navigate("/");
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={aoEnviar} className="w-full max-w-sm cartao space-y-4">
        <h1 className="text-xl font-semibold text-center">Estoque Casa do Campo</h1>

        <div>
          <label className="block text-sm mb-1" htmlFor="nome">
            Usuário
          </label>
          <input
            id="nome"
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            className="campo"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <button type="submit" className="botao-grande" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
