import { api } from "./api";

const CHAVE = "estoque-casa-do-campo:limite-quantidade-online";
const PADRAO_SE_NUNCA_BUSCOU = 20; // só usado antes do 1º login com internet

// RF07: busca o limite no servidor em vez de hardcodar — ver
// backend/src/routes/config.ts. Guarda em localStorage pra funcionar mesmo
// se o próximo carregamento do app acontecer offline.
export async function atualizarLimiteQuantidadeOnline(): Promise<void> {
  const { limiteQuantidadeOnline } = await api<{ limiteQuantidadeOnline: number }>("/config");
  localStorage.setItem(CHAVE, String(limiteQuantidadeOnline));
}

export function limiteQuantidadeOnlineCache(): number {
  const valor = localStorage.getItem(CHAVE);
  return valor ? Number(valor) : PADRAO_SE_NUNCA_BUSCOU;
}
