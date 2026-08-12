import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { IndicadorConexao } from "./IndicadorConexao";

export function Layout() {
  const { usuario, sair } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-marca text-white px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg">
          Estoque Casa do Campo
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <IndicadorConexao />
          {usuario?.perfil === "admin" && (
            <Link to="/admin/dashboard" className="underline">
              Painel
            </Link>
          )}
          <button onClick={sair} className="underline">
            Sair
          </button>
        </div>
      </header>
      <main className="max-w-md mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
