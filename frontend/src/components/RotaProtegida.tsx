import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Perfil } from "../lib/auth";

// Sem "somentePerfis": qualquer usuário logado passa.
// Com "somentePerfis": só quem tem um dos perfis listados passa (RF15).
export function RotaProtegida({
  somentePerfis,
  // A própria tela de troca de senha precisa ser alcançável por quem está com
  // senha provisória — senão o redirecionamento abaixo vira um laço infinito.
  permitirSenhaProvisoria = false,
}: {
  somentePerfis?: Perfil[];
  permitirSenhaProvisoria?: boolean;
}) {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;

  // Senha provisória só dá acesso à tela de troca de senha. Isto é espelho da
  // regra do servidor (src/middleware/auth.ts) — a checagem que vale é a de
  // lá; esta existe para o usuário ver a tela certa em vez de uma sequência
  // de erros 403.
  if (usuario.precisaTrocarSenha && !permitirSenhaProvisoria) {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (somentePerfis && !somentePerfis.includes(usuario.perfil)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
