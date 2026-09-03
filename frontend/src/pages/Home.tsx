import { Link } from "react-router-dom";

// Tela inicial do funcionário: só as ações do dia a dia em destaque
// (RNF05 — mínimo de passos, telas simples).
//
// Só a venda é botão grande. Antes compra e venda tinham o mesmo tamanho, e o
// tamanho na tela deveria refletir a frequência de uso: venda acontece dezenas
// de vezes por dia, no balcão, muitas vezes com o cliente esperando; compra
// acontece quando chega mercadoria, algumas vezes por semana. Dois botões
// grandes lado a lado também aumentam a chance de tocar no errado com a mão
// ocupada — e uma compra lançada como venda derruba o estoque em dobro.
export function Home() {
  return (
    <div className="flex flex-col gap-10 py-12">
      <Link to="/saida" className="botao-grande block text-center bg-red-700">
        Registrar Venda
      </Link>

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          to="/entrada"
          className="botao-medio block text-center bg-green-700"
        >
          Registrar compra
        </Link>
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
