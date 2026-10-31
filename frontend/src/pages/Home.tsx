import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// Tela inicial do funcionário: só as ações do dia a dia em destaque
// (RNF05 — mínimo de passos, telas simples).
//
// Só a venda é botão grande. O tamanho na tela reflete a frequência de uso:
// venda acontece dezenas de vezes por dia, no balcão, muitas vezes com o
// cliente esperando; compra acontece quando chega mercadoria, algumas vezes
// por semana. Dois botões grandes lado a lado também aumentam a chance de
// tocar no errado com a mão ocupada — e uma compra lançada como venda derruba
// o estoque em dobro.
//
// As ações estão separadas em dois grupos porque respondem a perguntas
// diferentes: "o que aconteceu agora no balcão" e "preciso mexer no
// cadastro". Misturadas numa fileira só, o cadastro competia visualmente com
// a venda sem nunca ser tão urgente quanto ela.
export function Home() {
  const local = useLocation();
  const navigate = useNavigate();
  const [sucesso, setSucesso] = useState<string | null>(null);

  // A tela de movimentação navega para cá com uma mensagem de sucesso no
  // state. Ela nunca era lida, então quem registrava uma venda voltava para a
  // tela inicial sem nenhuma confirmação de que tinha dado certo — e a dúvida
  // leva a registrar de novo, que é o erro mais caro desta tela.
  useEffect(() => {
    const recado = (local.state as { sucesso?: string } | null)?.sucesso;
    if (!recado) return;

    setSucesso(recado);
    // Limpa o state do histórico: sem isto, atualizar a página mostraria a
    // confirmação de uma venda feita horas atrás.
    navigate(".", { replace: true, state: null });

    const relogio = setTimeout(() => setSucesso(null), 6000);
    return () => clearTimeout(relogio);
  }, [local.state, navigate]);

  return (
    <div className="flex flex-col gap-8 py-6">
      {sucesso && (
        <p
          role="status"
          className="cartao border-green-200 bg-green-50 text-center text-sm font-medium text-green-800"
        >
          {sucesso}
        </p>
      )}

      <Link to="/saida" className="botao-grande block bg-venda text-center">
        Registrar Venda
      </Link>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Movimentações
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/entrada" className="botao-medio block bg-compra text-center">
            Registrar compra
          </Link>
          <Link to="/fiado" className="botao-medio block bg-fiado text-center">
            Fiado
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Cadastros
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/produtos" className="botao-medio block bg-produtos text-center">
            Produtos
          </Link>
          <Link to="/categorias" className="botao-medio block bg-categorias text-center">
            Categorias
          </Link>
        </div>
      </div>
    </div>
  );
}
