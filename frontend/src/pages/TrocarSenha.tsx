import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Usuario } from "../lib/auth";
import { api, ErroApi } from "../lib/api";
import { baixarCatalogo } from "../lib/sync";
import { atualizarLimiteQuantidadeOnline } from "../lib/config";

const MINIMO_CARACTERES = 10;

// Tela obrigatória no primeiro acesso de quem recebeu senha provisória do
// admin, e disponível a qualquer momento pelo menu. É o que garante que
// nenhuma senha escolhida por outra pessoa continue valendo.
export function TrocarSenha() {
  const { usuario, atualizarSessao } = useAuth();
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const obrigatoria = usuario?.precisaTrocarSenha === true;

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senhaNova !== confirmacao) {
      return setErro("As duas senhas novas não são iguais.");
    }
    if (senhaNova.length < MINIMO_CARACTERES) {
      return setErro(`A senha nova precisa de pelo menos ${MINIMO_CARACTERES} caracteres.`);
    }

    setEnviando(true);
    try {
      // A troca invalida o token anterior no servidor, então a resposta traz
      // um token novo — sem guardá-lo, o próprio usuário cairia para o login.
      const resultado = await api<{ token: string; usuario: Usuario }>("/auth/trocar-senha", {
        method: "POST",
        body: JSON.stringify({ senhaAtual, senhaNova }),
      });

      atualizarSessao(resultado.token, resultado.usuario);

      // Quem entrou com senha provisória ainda não baixou o catálogo (o
      // servidor bloqueava tudo até aqui) — é o momento de buscar.
      await Promise.allSettled([baixarCatalogo(), atualizarLimiteQuantidadeOnline()]);

      navigate("/", { replace: true });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível trocar a senha. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={aoEnviar} className="w-full max-w-sm cartao space-y-4">
        <h1 className="text-xl font-semibold text-center">Trocar senha</h1>

        {obrigatoria && (
          <p className="text-sm text-gray-600">
            Sua senha atual foi criada por outra pessoa. Escolha uma senha que só
            você saiba para continuar.
          </p>
        )}

        <div>
          <label className="block text-sm mb-1" htmlFor="senha-atual">
            Senha atual
          </label>
          <input
            id="senha-atual"
            type="password"
            className="campo"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="senha-nova">
            Senha nova
          </label>
          <input
            id="senha-nova"
            type="password"
            className="campo"
            autoComplete="new-password"
            minLength={MINIMO_CARACTERES}
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Pelo menos {MINIMO_CARACTERES} caracteres. Pode ser uma frase fácil de
            lembrar, como “cachorro azul na varanda”.
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="senha-confirmacao">
            Repita a senha nova
          </label>
          <input
            id="senha-confirmacao"
            type="password"
            className="campo"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        </div>

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <button type="submit" className="botao-grande" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Ao trocar a senha, o acesso é encerrado nos outros aparelhos.
        </p>
      </form>
    </div>
  );
}
