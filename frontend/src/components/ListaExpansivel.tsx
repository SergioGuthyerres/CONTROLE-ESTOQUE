import { useEffect, useState } from "react";

// Lista longa que começa cortada e abre no toque, como a mensagem comprida do
// WhatsApp.
//
// Existe porque as duas respostas óbvias são piores: mostrar tudo transforma
// 303 produtos num rolar infinito que esconde o que vem depois da lista, e
// mostrar só um pedaço sem dizer quantos ficaram de fora faz parecer que o
// resto não existe — que foi exatamente a reclamação sobre o "mais usados".
//
// O botão diz o número que falta, e não "ver mais": saber que são 295
// restantes é o que ajuda a decidir entre abrir e usar a busca.

export function useExpansivel(total: number, inicial = 8) {
  const [expandido, setExpandido] = useState(false);

  // Trocar o filtro ou a busca recomeça do começo. Sem isto, quem expandiu uma
  // vez ficaria com toda lista seguinte aberta, inclusive as curtas.
  useEffect(() => {
    setExpandido(false);
  }, [total]);

  return {
    expandido,
    limite: expandido ? total : inicial,
    restantes: Math.max(0, total - inicial),
    abrir: () => setExpandido(true),
    fechar: () => setExpandido(false),
  };
}

export function BotaoVerMais(props: {
  expandido: boolean;
  restantes: number;
  aoAbrir: () => void;
  aoFechar: () => void;
  rotulo?: string;
}) {
  if (props.restantes === 0) return null;

  return (
    <button
      type="button"
      className="w-full py-2 text-sm font-semibold text-marca underline"
      onClick={props.expandido ? props.aoFechar : props.aoAbrir}
    >
      {props.expandido
        ? "Ver menos"
        : `Ver mais ${props.restantes} ${props.rotulo ?? "itens"}`}
    </button>
  );
}
