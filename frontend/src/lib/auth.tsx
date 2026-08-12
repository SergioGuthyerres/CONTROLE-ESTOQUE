import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, salvarToken, obterToken, limparToken } from "./api";
import { baixarCatalogo, iniciarSincronizacaoAutomatica } from "./sync";
import { atualizarLimiteQuantidadeOnline } from "./config";

export type Perfil = "funcionario" | "admin";
export interface Usuario {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
}

const CHAVE_USUARIO = "estoque-casa-do-campo:usuario";

interface ContextoAuth {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (nome: string, senha: string) => Promise<void>;
  sair: () => void;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = obterToken();
    const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO);
    if (token && usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!usuario) return;
    // Sincronização automática só faz sentido com sessão ativa.
    return iniciarSincronizacaoAutomatica();
  }, [usuario]);

  async function entrar(nome: string, senha: string) {
    const resultado = await api<{ token: string; usuario: Usuario }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ nome, senha }),
    });
    salvarToken(resultado.token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(resultado.usuario));
    setUsuario(resultado.usuario);

    // Primeiro carregamento do catálogo — depois disso o app já funciona offline.
    await Promise.allSettled([baixarCatalogo(), atualizarLimiteQuantidadeOnline()]);
  }

  function sair() {
    limparToken();
    localStorage.removeItem(CHAVE_USUARIO);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return contexto;
}
