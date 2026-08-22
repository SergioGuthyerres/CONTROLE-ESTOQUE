import { Link } from "react-router-dom";

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link to="/admin/dashboard" className="underline">Dashboard</Link>
      <Link to="/admin/resumo-do-dia" className="underline">Dia</Link>
      <Link to="/admin/relatorios" className="underline">Relatórios</Link>
      <Link to="/admin/historico" className="underline">Histórico</Link>
      <Link to="/admin/usuarios" className="underline">Usuários</Link>
    </nav>
  );
}
