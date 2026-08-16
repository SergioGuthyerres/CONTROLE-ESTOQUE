// Gera dist/_headers (formato do Cloudflare Pages) depois do build.
//
// É gerado em vez de escrito à mão porque a CSP precisa listar o domínio exato
// da API em connect-src, e esse domínio só existe na variável VITE_API_URL do
// ambiente de build. Um _headers fixo no repositório ficaria desatualizado no
// dia em que a API mudasse de endereço — e a falha apareceria como "o app não
// carrega nada" no celular do funcionário, sem erro óbvio.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const apiUrl = process.env.VITE_API_URL;

if (!apiUrl) {
  console.error(
    "\nVITE_API_URL não definida — não dá para gerar a CSP sem saber o endereço da API.\n" +
      "Defina a variável no ambiente de build (Cloudflare Pages: Settings > Environment variables).\n"
  );
  process.exit(1);
}

const origemApi = new URL(apiUrl).origin;

// Notas sobre as escolhas:
//
// - script-src 'self': o app não carrega script de CDN nenhum. Esta é a linha
//   que de fato protege o token guardado em localStorage: um XSS só rouba o
//   token se conseguir executar script, e aqui só executa o que veio do
//   próprio domínio.
// - style-src inclui 'unsafe-inline' porque o Vite injeta estilos inline no
//   bundle. Estilo inline não executa código; o risco é cosmético.
// - connect-src limita para onde o app pode mandar dados — inclusive um token
//   roubado não pode ser exfiltrado para um servidor qualquer.
// - frame-ancestors 'none' impede que o app seja embutido num iframe de outro
//   site (clickjacking sobre botões de saída de estoque).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${origemApi}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const conteudo = `# Gerado por scripts/gerar-headers.mjs — não editar à mão.
# API considerada na CSP: ${origemApi}

/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
`;

const destino = resolve(process.cwd(), "dist/_headers");
writeFileSync(destino, conteudo);
console.log(`_headers gerado (connect-src: ${origemApi})`);
