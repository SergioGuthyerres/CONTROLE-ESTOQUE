import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ErroApi } from "../../lib/api";
import { AdminNav } from "../../components/AdminNav";
import { useAuth } from "../../lib/auth";

interface UsuarioApi {
  id: string;
  nome: string;
  perfil: "funcionario" | "admin";
  ativo: boolean;
  precisaTrocarSenha: boolean;
  criadoEm: string;
}

interface RespostaComSenha {
  usuario: UsuarioApi;
  senhaProvisoria: string;
}

// RF14/RF15: a tela que permite o dono criar a conta do funcionário sem
// ninguém precisar mexer no banco nem rodar o seed de exemplo (que é o que
// colocava as senhas públicas "admin123"/"func123" em produção).
export function Usuarios() {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioApi[] | null>(null);
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<"funcionario" | "admin">("funcionario");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // A senha provisória existe só nesta resposta — o servidor guarda apenas o
  // hash. Se o admin fechar a tela sem anotar, o caminho é resetar de novo.
  const [senhaMostrada, setSenhaMostrada] = useState<{ nome: string; senha: string } | null>(null);

  async function carregar() {
    setUsuarios(await api<UsuarioApi[]>("/usuarios"));
  }

  useEffect(() => {
    carregar().catch(() => setErro("Não foi possível carregar os usuários."));
  }, []);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await api<RespostaComSenha>("/usuarios", {
        method: "POST",
        body: JSON.stringify({ nome: nome.trim(), perfil }),
      });
      setSenhaMostrada({ nome: resposta.usuario.nome, senha: resposta.senhaProvisoria });
      setNome("");
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível criar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  async function resetarSenha(alvo: UsuarioApi) {
    setErro(null);
    try {
      const resposta = await api<RespostaComSenha>(`/usuarios/${alvo.id}/resetar-senha`, {
        method: "POST",
      });
      setSenhaMostrada({ nome: alvo.nome, senha: resposta.senhaProvisoria });
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível resetar a senha.");
    }
  }

  async function alternarAtivo(alvo: UsuarioApi) {
    setErro(null);
    try {
      await api(`/usuarios/${alvo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !alvo.ativo }),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível alterar o usuário.");
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-lg font-semibold">Usuários</h1>
      <AdminNav />

      {senhaMostrada && (
        <div className="cartao border-2 border-amber-500 space-y-2">
          <p className="text-sm font-semibold">
            Senha provisória de {senhaMostrada.nome}
          </p>
          <p className="font-mono text-lg break-all select-all">{senhaMostrada.senha}</p>
          <p className="text-xs text-gray-600">
            Anote e entregue à pessoa agora. Esta senha não aparece de novo — ela
            não fica guardada no sistema. No primeiro acesso, o sistema vai exigir
            que ela escolha uma senha própria.
          </p>
          <button className="botao-medio bg-gray-700" onClick={() => setSenhaMostrada(null)}>
            Já anotei
          </button>
        </div>
      )}

      <form onSubmit={criar} className="cartao space-y-3">
        <h2 className="font-semibold text-sm">Novo usuário</h2>
        <div>
          <label className="block text-sm mb-1" htmlFor="novo-nome">
            Nome de usuário
          </label>
          <input
            id="novo-nome"
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="ex: joao.silva"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="novo-perfil">
            Perfil
          </label>
          <select
            id="novo-perfil"
            className="campo"
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as "funcionario" | "admin")}
          >
            <option value="funcionario">Funcionário</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button type="submit" className="botao-medio" disabled={enviando}>
          {enviando ? "Criando..." : "Criar usuário"}
        </button>
      </form>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <ul className="cartao divide-y divide-gray-200">
        {usuarios?.map((item) => (
          <li key={item.id} className="py-3 text-sm space-y-1">
            <div className="flex justify-between items-center">
              <span className={item.ativo ? "font-medium" : "font-medium text-gray-400 line-through"}>
                {item.nome}
              </span>
              <span className="text-gray-500">
                {item.perfil === "admin" ? "Administrador" : "Funcionário"}
              </span>
            </div>
            {item.precisaTrocarSenha && (
              <p className="text-xs text-amber-700">Ainda não trocou a senha provisória</p>
            )}
            <div className="flex gap-3 text-xs">
              <button className="underline" onClick={() => resetarSenha(item)}>
                Resetar senha
              </button>
              {/* O próprio usuário logado não aparece com opção de desativar:
                  desligar a si mesmo é o caminho mais rápido para ficar
                  trancado do lado de fora. O servidor também recusa. */}
              {item.id !== usuarioLogado?.usuarioId && (
                <button className="underline" onClick={() => alternarAtivo(item)}>
                  {item.ativo ? "Desativar acesso" : "Reativar acesso"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Link to="/" className="botao-medio block text-center bg-gray-700">
        Voltar
      </Link>
    </div>
  );
}
