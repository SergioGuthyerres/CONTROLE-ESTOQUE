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
  constructor(public status: number, message: string) {
    super(message);
  }
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
    throw new ErroApi(resposta.status, corpo.erro ?? `Erro ${resposta.status}`);
  }

  if (resposta.status === 204) return undefined as T;
  return resposta.json();
}

export { ErroApi };
