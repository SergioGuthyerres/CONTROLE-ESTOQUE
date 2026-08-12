// Id persistente do aparelho — usado como "origemDispositivo" nas
// movimentações, para investigar estoque negativo depois (ver
// docs/especificacao-requisitos.md, "Regras de negócio explícitas").
const CHAVE = "estoque-casa-do-campo:dispositivo-id";

export function idDoDispositivo(): string {
  let id = localStorage.getItem(CHAVE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CHAVE, id);
  }
  return id;
}
