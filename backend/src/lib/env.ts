import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required("JWT_SECRET"),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  // RF07: acima desse limite de unidades, a saída exige o dispositivo online
  // para conferir o estoque no servidor antes de confirmar.
  limiteQuantidadeOnline: Number(process.env.LIMITE_QUANTIDADE_ONLINE ?? 20),
};
