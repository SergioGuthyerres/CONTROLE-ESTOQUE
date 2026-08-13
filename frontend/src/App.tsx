import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { RotaProtegida } from "./components/RotaProtegida";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { TelaMovimentacao } from "./pages/TelaMovimentacao";
import { CadastroProduto } from "./pages/CadastroProduto";
import { CadastroCategoria } from "./pages/CadastroCategoria";
import { Dashboard } from "./pages/admin/Dashboard";
import { Relatorios } from "./pages/admin/Relatorios";
import { Historico } from "./pages/admin/Historico";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

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

              <Route element={<RotaProtegida somentePerfis={["admin"]} />}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/relatorios" element={<Relatorios />} />
                <Route path="/admin/historico" element={<Historico />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
