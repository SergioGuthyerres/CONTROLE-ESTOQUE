import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { RotaProtegida } from "./components/RotaProtegida";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { TrocarSenha } from "./pages/TrocarSenha";
import { Home } from "./pages/Home";
import { TelaMovimentacao } from "./pages/TelaMovimentacao";
import { CadastroProduto } from "./pages/CadastroProduto";
import { CadastroCategoria } from "./pages/CadastroCategoria";
import { Devedores } from "./pages/Devedores";
import { Dashboard } from "./pages/admin/Dashboard";
import { Relatorios } from "./pages/admin/Relatorios";
import { ResumoDoDia } from "./pages/admin/ResumoDoDia";
import { Historico } from "./pages/admin/Historico";
import { Usuarios } from "./pages/admin/Usuarios";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Fora do Layout e sem exigir senha definitiva: é a única tela que
              quem tem senha provisória consegue abrir. */}
          <Route element={<RotaProtegida permitirSenhaProvisoria />}>
            <Route path="/trocar-senha" element={<TrocarSenha />} />
          </Route>

          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route
                path="/entrada"
                element={<TelaMovimentacao tipo="entrada" />}
              />
              <Route
                path="/saida"
                element={<TelaMovimentacao tipo="saida" />}
              />
              <Route path="/produtos" element={<CadastroProduto />} />
              <Route path="/categorias" element={<CadastroCategoria />} />
              {/* Fora do bloco de admin de propósito: cobrar fiado é
                  trabalho de balcão, e quem atende é o funcionário. */}
              <Route path="/fiado" element={<Devedores />} />

              <Route element={<RotaProtegida somentePerfis={["admin"]} />}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/resumo-do-dia" element={<ResumoDoDia />} />
                <Route path="/admin/relatorios" element={<Relatorios />} />
                <Route path="/admin/historico" element={<Historico />} />
                <Route path="/admin/usuarios" element={<Usuarios />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
