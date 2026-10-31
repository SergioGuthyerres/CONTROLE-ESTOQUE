import { Link, useLocation } from "react-router-dom";

// Navegação entre as telas do painel.
//
// Eram links sublinhados pequenos, um colado no outro: alvo difícil no
// celular e sem nenhum sinal de onde a pessoa está. Agora são chips do mesmo
// tamanho das outras telas, e o da tela aberta fica marcado — num painel com
// seis destinos parecidos, não saber em qual você está é o que faz voltar
// para o início só para se localizar.
//
// "Fiado" mora aqui apesar de a rota ficar fora de /admin: a tela é aberta a
// funcionário, mas para o admin ela é uma das do painel, e sair dela perdendo
// o menu fazia parecer outro sistema (a própria tela de devedores mostra esta
// navegação quando quem abre é admin).
const DESTINOS = [
  { para: "/admin/dashboard", rotulo: "Painel" },
  { para: "/admin/resumo-do-dia", rotulo: "Dia" },
  { para: "/admin/relatorios", rotulo: "Relatórios" },
  { para: "/admin/historico", rotulo: "Histórico" },
  { para: "/fiado", rotulo: "Fiado" },
  { para: "/admin/usuarios", rotulo: "Usuários" },
];

export function AdminNav() {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Telas do painel">
      {DESTINOS.map((destino) => {
        const atual = pathname === destino.para;
        return (
          <Link
            key={destino.para}
            to={destino.para}
            className="chip"
            aria-current={atual ? "page" : undefined}
            aria-pressed={atual}
          >
            {destino.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
