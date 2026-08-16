import "dotenv/config";
import { z } from "zod";

// Placeholders que existem no .env.example e em tutoriais. Se algum deles
// chegar em produção, o servidor recusa subir — é o erro mais comum de
// deploy e o que transforma o JWT numa assinatura que qualquer um forja.
const SEGREDOS_PROIBIDOS = [
  "troque-por-um-valor-aleatorio-longo-em-producao",
  "secret",
  "changeme",
  "mude-me",
  "your-secret-key",
  "dev",
  "test",
];

const esquema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    // Em produção a API deve escutar SÓ em 127.0.0.1: quem fala com o mundo é
    // o Caddy, que tem o certificado TLS. Escutando em 0.0.0.0, a porta 3000
    // fica acessível direto pela internet, em HTTP puro — senha e token
    // trafegando em texto claro, contornando todo o resto.
    HOST: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET precisa de pelo menos 32 caracteres — gere com: openssl rand -base64 48")
      .refine(
        (valor) => !SEGREDOS_PROIBIDOS.includes(valor.trim().toLowerCase()),
        "JWT_SECRET ainda é o valor de exemplo. Gere um real com: openssl rand -base64 48"
      ),
    // Lista separada por vírgula: em produção o PWA vive num domínio e a API
    // em outro, e pode haver um domínio de preview do Cloudflare Pages.
    FRONTEND_URL: z.string().min(1).default("http://localhost:5173"),
    LIMITE_QUANTIDADE_ONLINE: z.coerce.number().positive().default(20),
    // Atrás do Caddy/Nginx o IP real vem no X-Forwarded-For. Sem isso o
    // rate limit enxerga todo mundo como o mesmo IP (o do proxy).
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((valor) => valor === "true"),
    // Janela e teto do rate limit de login — configuráveis porque uma loja
    // com muitos funcionários no mesmo IP (mesmo wi-fi) pode precisar afrouxar.
    LOGIN_MAX_TENTATIVAS: z.coerce.number().int().positive().default(10),
    LOGIN_JANELA_MINUTOS: z.coerce.number().int().positive().default(15),
  })
  .superRefine((valores, ctx) => {
    if (valores.NODE_ENV !== "production") return;

    // Em produção, deixar o CORS apontando pra localhost significa que o PWA
    // real não consegue chamar a API — falha silenciosa e confusa no celular.
    if (valores.FRONTEND_URL.includes("localhost")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message:
          "Em produção, FRONTEND_URL deve ser a URL pública do PWA (https://...), não localhost",
      });
    }
    if (!valores.TRUST_PROXY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TRUST_PROXY"],
        message:
          "Em produção a API roda atrás do Caddy — defina TRUST_PROXY=true, senão o rate limit trata todos os acessos como um único IP",
      });
    }
  });

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((problema) => `  - ${problema.path.join(".")}: ${problema.message}`)
    .join("\n");
  console.error(`\nConfiguração inválida em .env:\n${problemas}\n`);
  process.exit(1);
}

const valores = resultado.data;

export const env = {
  nodeEnv: valores.NODE_ENV,
  emProducao: valores.NODE_ENV === "production",
  port: valores.PORT,
  // Em dev precisa ser acessível pelo celular na mesma rede para testar o PWA;
  // em produção, só pelo proxy local.
  host: valores.HOST ?? (valores.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0"),
  jwtSecret: valores.JWT_SECRET,
  // RF07: acima desse limite de unidades, a saída exige o dispositivo online
  // para conferir o estoque no servidor antes de confirmar.
  limiteQuantidadeOnline: valores.LIMITE_QUANTIDADE_ONLINE,
  origensPermitidas: valores.FRONTEND_URL.split(",")
    .map((origem) => origem.trim().replace(/\/$/, ""))
    .filter(Boolean),
  trustProxy: valores.TRUST_PROXY,
  loginMaxTentativas: valores.LOGIN_MAX_TENTATIVAS,
  loginJanelaMs: valores.LOGIN_JANELA_MINUTOS * 60 * 1000,
};
