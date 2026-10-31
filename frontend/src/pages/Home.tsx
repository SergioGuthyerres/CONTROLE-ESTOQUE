import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  IconeCategorias,
  IconeCompra,
  IconeConfirmado,
  IconeFiado,
  IconePainel,
  IconeProdutos,
  IconeVenda,
} from "../components/Icones";

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Tela inicial: um menu de ações escritas por extenso, uma por linha.
//
// Só a venda tem destaque. O tamanho na tela reflete a frequência de uso:
// venda acontece dezenas de vezes por dia, no balcão, muitas vezes com o
// cliente esperando; compra acontece quando chega mercadoria, algumas vezes
// por semana. Dois destaques lado a lado também aumentariam a chance de tocar
// no errado com a mão ocupada — e uma compra lançada como venda derruba o
// estoque em dobro.
//
// Cada linha diz o que tem lá dentro, e não só o nome da tela. "Fiado — 3
// pessoas devendo R$ 545,00" responde a pergunta sem abrir nada, que é o
// caminho mais curto possível.
export function Home() {
  const local = useLocation();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [fiado, setFiado] = useState<{ pessoas: number; total: number } | null>(null);

  const produtos = useLiveQuery(() => db.produtos.toArray(), []);
  const emFalta = (produtos ?? []).filter(
    (p) => p.estoqueMinimo > 0 && p.estoqueAtualServidor <= p.estoqueMinimo,
  ).length;

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

  // O resumo do fiado é conveniência, e conveniência nunca pode derrubar a
  // tela: sem internet, ou numa API mais antiga que esta versão do app, o
  // botão simplesmente não mostra o número. É a mesma regra que saiu do
  // incidente dos atalhos de produto (ver src/lib/sync.ts).
  useEffect(() => {
    let vivo = true;
    api<{ devedores: unknown[]; total: number }>("/fiado/devedores")
      .then((r) => {
        if (vivo) setFiado({ pessoas: r.devedores.length, total: r.total });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const resumoFiado =
    fiado === null
      ? "Quem levou e ainda não pagou"
      : fiado.pessoas === 0
        ? "Ninguém está devendo"
        : `${fiado.pessoas} pessoa${fiado.pessoas === 1 ? "" : "s"} devendo ${reais(fiado.total)}`;

  const resumoProdutos =
    produtos === undefined
      ? "Cadastrar, corrigir e arquivar"
      : `${produtos.length} cadastrado${produtos.length === 1 ? "" : "s"}${
          emFalta > 0 ? ` · ${emFalta} com estoque baixo` : ""
        }`;

  return (
    <div className="flex flex-col gap-4 py-2">
      {sucesso && (
        <p
          role="status"
          className="cartao flex items-center gap-3 border-green-200 bg-green-50 text-sm font-semibold text-green-800"
        >
          <IconeConfirmado className="h-5 w-5" />
          <span>{sucesso}</span>
        </p>
      )}

      <Link to="/saida" className="menu-item menu-item-destaque bg-venda">
        <IconeVenda className="h-10 w-10" />
        <span className="min-w-0 flex-1">
          <span className="menu-item-titulo">Registrar Venda</span>
          <span className="menu-item-sub">O que saiu agora no balcão</span>
        </span>
        <span aria-hidden="true" className="text-2xl opacity-70">
          ›
        </span>
      </Link>

      <Link to="/entrada" className="menu-item bg-compra">
        <IconeCompra />
        <span className="min-w-0 flex-1">
          <span className="menu-item-titulo">Registrar Compra</span>
          <span className="menu-item-sub">Mercadoria que chegou</span>
        </span>
        <span aria-hidden="true" className="text-2xl opacity-70">
          ›
        </span>
      </Link>

      <Link to="/fiado" className="menu-item bg-fiado">
        <IconeFiado />
        <span className="min-w-0 flex-1">
          <span className="menu-item-titulo">Fiado</span>
          <span className="menu-item-sub">{resumoFiado}</span>
        </span>
        <span aria-hidden="true" className="text-2xl opacity-70">
          ›
        </span>
      </Link>

      <Link to="/produtos" className="menu-item bg-produtos">
        <IconeProdutos />
        <span className="min-w-0 flex-1">
          <span className="menu-item-titulo">Produtos</span>
          <span className="menu-item-sub">{resumoProdutos}</span>
        </span>
        <span aria-hidden="true" className="text-2xl opacity-70">
          ›
        </span>
      </Link>

      <Link to="/categorias" className="menu-item bg-categorias">
        <IconeCategorias />
        <span className="min-w-0 flex-1">
          <span className="menu-item-titulo">Categorias</span>
          <span className="menu-item-sub">Como os produtos são agrupados</span>
        </span>
        <span aria-hidden="true" className="text-2xl opacity-70">
          ›
        </span>
      </Link>

      {usuario?.perfil === "admin" && (
        <Link to="/admin/dashboard" className="menu-item bg-marca">
          <IconePainel />
          <span className="min-w-0 flex-1">
            <span className="menu-item-titulo">Painel</span>
            <span className="menu-item-sub">Resumo do dia, histórico e relatórios</span>
          </span>
          <span aria-hidden="true" className="text-2xl opacity-70">
            ›
          </span>
        </Link>
      )}
    </div>
  );
}
