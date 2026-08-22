# Frontend — Casa do Campo Estoque

PWA em React + TypeScript + Vite, com dados locais em IndexedDB (via Dexie)
para funcionar offline. Ver [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
antes de mexer.

## Rodando localmente

```bash
npm install
cp .env.example .env   # aponta para o backend, padrão http://localhost:3000
npm run dev              # http://localhost:5173
```

Precisa do backend rodando (ver `../backend/README.md`) e logado com um
usuário do `seed:dev` pra ter dados.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o app com hot reload |
| `npm run build` | Build de produção (gera `dist/`, já com service worker/PWA) |
| `npm run preview` | Serve o build de produção localmente, pra testar a PWA de verdade |
| `npm test` | Testes da sincronização offline e das datas (vitest + fake-indexeddb) |
| `npm run typecheck` | Só o `tsc -b`, sem gerar `dist/` |

## Estrutura

```
src/
├─ db/db.ts            Schema do IndexedDB (Dexie) — cache local
├─ lib/
│  ├─ api.ts            fetch com token, base URL
│  ├─ auth.tsx           contexto de sessão (login/logout)
│  ├─ sync.ts            sincronização com o backend
│  ├─ estoque.ts         estoque "otimista" (cache + pendentes locais)
│  ├─ config.ts          limite de quantidade que exige internet (RF07)
│  └─ enums.ts           motivos por tipo de movimentação
├─ components/          Peças reutilizáveis (busca de produto, layout, nav admin)
└─ pages/                Uma tela por arquivo; pages/admin/ é só para "admin"

testes/                 vitest; roda com IndexedDB em memória, sem navegador
```

## Instalar como app no celular (PWA)

Depois de publicado (HTTPS obrigatório para o service worker funcionar fora
de localhost):

- **Android (Chrome):** abrir o link → menu → "Adicionar à tela inicial".
- **iPhone (Safari):** abrir o link → botão Compartilhar → "Adicionar à Tela
  de Início". É um passo manual, sem loja de apps (ver seção 5.4 do
  documento de visão) — fazer isso junto com o funcionário na entrega.

## Testando offline

`npm run build && npm run preview`, abrir no navegador, desligar o Wi-Fi (ou
usar as devtools → Network → Offline) e continuar usando: entrada/saída
continuam funcionando porque leem/escrevem só no IndexedDB local até a
sincronização rodar de novo.
