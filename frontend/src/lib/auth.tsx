import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, salvarToken, obterToken, limparToken, registrarAoPerderSessao } from "./api";
import { baixarCatalogo, iniciarSincronizacaoAutomatica } from "./sync";
import { atualizarLimiteQuantidadeOnline } from "./config";

export type Perfil = "funcionario" | "admin";
export interface Usuario {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  // Senha provisória criada pelo admin: o app só libera a tela de troca de
  // senha até isso virar false (o servidor recusa o resto de qualquer jeito).
  precisaTrocarSenha?: boolean;
}

const CHAVE_USUARIO = "estoque-casa-do-campo:usuario";

interface ContextoAuth {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (nome: string, senha: string) => Promise<void>;
  sair: () => void;
  // Usada pela tela de troca de senha: o servidor devolve um token novo
  // (o anterior é invalidado na troca) e a sessão local precisa acompanhar.
  atualizarSessao: (token: string, usuario: Usuario) => void;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(() => {
    limparToken();
    localStorage.removeItem(CHAVE_USUARIO);
    setUsuario(null);
  }, []);

  // Qualquer 401 vindo de qualquer chamada derruba a sessão local na hora —
  // inclusive as que acontecem em background, como a sincronização.
  useEffect(() => {
    registrarAoPerderSessao(() => {
      localStorage.removeItem(CHAVE_USUARIO);
      setUsuario(null);
    });
  }, []);

  useEffect(() => {
    const token = obterToken();
    const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO);

    if (!token || !usuarioSalvo) {
      setCarregando(false);
      return;
    }

    // Mostra a sessão guardada de imediato: o app precisa abrir offline
    // (RNF02) e travar aqui esperando a rede quebraria esse requisito.
    setUsuario(JSON.parse(usuarioSalvo));
    setCarregando(false);

    // Em seguida, e só se houver internet, confirma com o servidor que a
    // sessão ainda vale. É assim que um acesso revogado enquanto o celular
    // estava offline cai assim que ele reconecta. Falha de rede é ignorada
    // de propósito — offline não pode significar deslogado.
    api<Usuario>("/auth/eu")
      .then((atual) => {
        setUsuario(atual);
        localStorage.setItem(CHAVE_USUARIO, JSON.stringify(atual));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!usuario) return;
    // Sincronização automática só faz sentido com sessão ativa. E não deve
    // rodar com senha provisória: o servidor recusaria tudo com 403.
    if (usuario.precisaTrocarSenha) return;
    return iniciarSincronizacaoAutomatica();
  }, [usuario]);

  function guardarSessao(token: string, dados: Usuario) {
    salvarToken(token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(dados));
    setUsuario(dados);
  }

  async function entrar(nome: string, senha: string) {
    const resultado = await api<{ token: string; usuario: Usuario }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ nome, senha }),
    });
    guardarSessao(resultado.token, resultado.usuario);

    // Com senha provisória o servidor bloqueia todo o resto — não adianta
    // tentar baixar catálogo antes da troca.
    if (resultado.usuario.precisaTrocarSenha) return;

    // Primeiro carregamento do catálogo — depois disso o app já funciona offline.
    await Promise.allSettled([baixarCatalogo(), atualizarLimiteQuantidadeOnline()]);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, entrar, sair, atualizarSessao: guardarSessao }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return contexto;
}
