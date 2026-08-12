import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Perfil } from "../lib/auth";

// Sem "somentePerfis": qualquer usuário logado passa.
// Com "somentePerfis": só quem tem um dos perfis listados passa (RF15).
export function RotaProtegida({ somentePerfis }: { somentePerfis?: Perfil[] }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  if (somentePerfis && !somentePerfis.includes(usuario.perfil)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
