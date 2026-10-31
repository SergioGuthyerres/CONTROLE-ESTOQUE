// Tema claro ou escuro.
//
// O claro é o padrão, e de propósito: o app é usado no balcão, muitas vezes
// com a loja aberta e luz entrando, onde fundo claro lê melhor. O escuro
// existe para quem fecha o caixa à noite e para quem simplesmente prefere.
//
// A escolha NÃO segue o `prefers-color-scheme` do aparelho. Um sistema que
// muda de cor sozinho porque o celular entrou no modo noturno às 18h assusta
// quem não sabe que isso existe — e esse é exatamente o público daqui
// (RNF05). Só troca quem apertar o botão.

export type Tema = "claro" | "escuro";

const CHAVE = "estoque-casa-do-campo:tema";

// Cor da barra do navegador no celular. Sem isto, o topo do sistema fica no
// azul da marca enquanto a tela por baixo está escura.
const COR_DA_BARRA: Record<Tema, string> = {
  claro: "#1F3864",
  escuro: "#0e1320",
};

export function temaSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE) === "escuro" ? "escuro" : "claro";
  } catch {
    // Navegador em janela anônima, ou armazenamento bloqueado. O app continua
    // funcionando no tema padrão — isto aqui é preferência, não dado.
    return "claro";
  }
}

export function aplicarTema(tema: Tema): void {
  // O atributo fica no <html>, que é onde as variáveis de src/index.css
  // moram. Trocar este atributo repinta o app inteiro.
  document.documentElement.dataset.tema = tema;

  const metaCor = document.querySelector('meta[name="theme-color"]');
  if (metaCor) metaCor.setAttribute("content", COR_DA_BARRA[tema]);
}

export function salvarTema(tema: Tema): void {
  aplicarTema(tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Vale para esta sessão mesmo sem conseguir guardar.
  }
}

export function alternarTema(atual: Tema): Tema {
  const novo: Tema = atual === "claro" ? "escuro" : "claro";
  salvarTema(novo);
  return novo;
}

// Chamado antes do React montar (ver src/main.tsx). Se esperasse o primeiro
// render, quem usa o escuro veria a tela branca piscar a cada abertura.
export function iniciarTema(): Tema {
  const tema = temaSalvo();
  aplicarTema(tema);
  return tema;
}
