import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { IndicadorConexao } from "./IndicadorConexao";
import { alternarTema, temaSalvo, type Tema } from "../lib/tema";

export function Layout() {
  const { usuario, sair } = useAuth();
  const [tema, setTema] = useState<Tema>(temaSalvo);

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-marca text-white px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="font-semibold text-lg">
          Casa do Campo
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <IndicadorConexao />

          {/* Ícone e não texto: o cabeçalho já tem três links e é a parte da
              tela com menos espaço no celular. O aria-label e o title dizem
              o que é para quem usa leitor de tela ou passa o mouse. */}
          <button
            type="button"
            onClick={() => setTema(alternarTema(tema))}
            aria-label={tema === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
            title={tema === "claro" ? "Tema escuro" : "Tema claro"}
            className="rounded-lg p-1.5 active:scale-95 transition"
          >
            {tema === "claro" ? <IconeLua /> : <IconeSol />}
          </button>

          {usuario?.perfil === "admin" && (
            <Link to="/admin/dashboard" className="underline">
              Painel
            </Link>
          )}
          <Link to="/trocar-senha" className="underline">
            Senha
          </Link>
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

function IconeLua() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function IconeSol() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
