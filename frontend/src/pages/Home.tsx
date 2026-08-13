import { Link } from "react-router-dom";

// Tela inicial do funcionário: só as duas ações do dia a dia em destaque
// (RNF05 — mínimo de passos, telas simples). Cadastro fica em segundo plano.
export function Home() {
  return (
    <div className="flex flex-col justify-between gap-20 py-12">
      <div className="flex flex-col justify-between gap-10 ">
        <Link
          to="/entrada"
          className="botao-grande block text-center bg-green-700"
        >
          Registrar Compra
        </Link>
        <Link to="/saida" className="botao-grande block text-center bg-red-700">
          Registrar Venda
        </Link>
      </div>

      <div className="pt-6 flex text-center text-sm text-gray-500 space-x-4 gap-8 py-20">
        <Link
          to="/produtos"
          className="botao-medio block text-center bg-orange-700"
        >
          Cadastrar produto
        </Link>
        <Link
          to="/categorias"
          className="botao-medio block text-center bg-blue-700"
        >
          Cadastrar categoria
        </Link>
      </div>
    </div>
  );
}
