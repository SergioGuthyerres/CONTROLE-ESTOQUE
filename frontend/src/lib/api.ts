const BASE_URL = import.meta.env.VITE_API_URL;
const CHAVE_TOKEN = "estoque-casa-do-campo:token";

export function salvarToken(token: string) {
  localStorage.setItem(CHAVE_TOKEN, token);
}
export function obterToken(): string | null {
  return localStorage.getItem(CHAVE_TOKEN);
}
export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}

class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
    // Código de negócio devolvido pela API (ex: "SENHA_PROVISORIA"), quando há.
    public codigo?: string
  ) {
    super(message);
  }
}

// O servidor pode encerrar a sessão a qualquer momento: token expirado, senha
// trocada em outro aparelho, funcionário desativado. Quando isso acontece, o
// app precisa saber — sem isto, o usuário fica numa tela que só mostra erro a
// cada ação e não entende que basta entrar de novo.
type AoPerderSessao = () => void;
let aoPerderSessao: AoPerderSessao = () => {};

export function registrarAoPerderSessao(callback: AoPerderSessao) {
  aoPerderSessao = callback;
}

// Wrapper fino sobre fetch — todo endpoint autenticado passa por aqui.
// Lança ErroApi em respostas não-2xx pra quem chamar decidir o que mostrar.
export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = obterToken();
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opcoes.headers,
    },
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));

    // 401 é sempre sessão morta. Limpar aqui, num único lugar, evita o estado
    // em que o app acha que está logado e o servidor discorda.
    if (resposta.status === 401 && caminho !== "/auth/login") {
      limparToken();
      aoPerderSessao();
    }

    throw new ErroApi(resposta.status, corpo.erro ?? `Erro ${resposta.status}`, corpo.codigo);
  }

  if (resposta.status === 204) return undefined as T;
  return resposta.json();
}

export { ErroApi };
