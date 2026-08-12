import { Link } from "react-router-dom";

// Tela inicial do funcionário: só as duas ações do dia a dia em destaque
// (RNF05 — mínimo de passos, telas simples). Cadastro fica em segundo plano.
export function Home() {
  return (
    <div className="space-y-4 pt-4">
      <Link to="/entrada" className="botao-grande block text-center bg-green-700">
        Registrar Entrada
      </Link>
      <Link to="/saida" className="botao-grande block text-center bg-red-700">
        Registrar Saída
      </Link>

      <div className="pt-6 text-center text-sm text-gray-500 space-x-4">
        <Link to="/produtos" className="underline">
          Cadastrar produto
        </Link>
        <Link to="/categorias" className="underline">
          Cadastrar categoria
        </Link>
      </div>
    </div>
  );
}
