import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";

// 12 rodadas: ~250ms por verificação numa VPS free tier. Suficiente para
// tornar força bruta offline cara caso o arquivo do banco vaze, e barato o
// bastante para um login que acontece uma vez a cada 30 dias.
const CUSTO_BCRYPT = 12;

// Senhas fracas conhecidas + as que este projeto já publicou no README.
// "admin123" e "func123" estão num repositório público — se alguém tentar
// reusá-las, o sistema recusa.
const SENHAS_PROIBIDAS = new Set([
  "admin123",
  "func123",
  "12345678",
  "123456789",
  "1234567890",
  "senha123",
  "password",
  "password123",
  "estoque123",
  "casadocampo",
  "qwertyuiop",
]);

// 10 caracteres em vez de exigir símbolo/maiúscula: para o público deste
// sistema, uma regra de composição complexa leva a senha anotada num papel
// colado no monitor. Comprimento mínimo maior protege mais e atrapalha menos.
export const esquemaSenha = z
  .string()
  .min(10, "A senha precisa de pelo menos 10 caracteres")
  .max(128, "A senha é longa demais")
  .refine(
    (senha) => !SENHAS_PROIBIDAS.has(senha.trim().toLowerCase()),
    "Essa senha é conhecida demais (ou é uma das senhas de exemplo do projeto). Escolha outra."
  )
  .refine(
    (senha) => !/^(.)\1+$/.test(senha),
    "A senha não pode ser um único caractere repetido"
  );

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I): a senha inicial vai ser
// lida em voz alta ou digitada num celular pelo dono da loja.
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// randomInt do módulo crypto, não Math.random — Math.random é previsível e
// não serve para gerar credencial.
export function gerarSenhaAleatoria(tamanho = 16): string {
  let senha = "";
  for (let i = 0; i < tamanho; i++) {
    senha += ALFABETO[randomInt(ALFABETO.length)];
  }
  return senha;
}
