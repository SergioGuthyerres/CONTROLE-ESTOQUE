# Estoque Casa do Campo

[![CI](https://github.com/SergioGuthyerres/CONTROLE-ESTOQUE/actions/workflows/ci.yml/badge.svg)](https://github.com/SergioGuthyerres/CONTROLE-ESTOQUE/actions/workflows/ci.yml)

Sistema de controle de estoque com painel administrativo para a Casa do
Campo. Nome provisório — identidade visual ainda em aberto.

## Documentação

Antes de mexer no código, ler nesta ordem:

1. [docs/documento-de-visao.md](docs/documento-de-visao.md) — o problema, as
   restrições do negócio (sem código de barras, orçamento quase zero, baixa
   maturidade digital) e as decisões que vêm delas.
2. [docs/especificacao-requisitos.md](docs/especificacao-requisitos.md) —
   requisitos numerados (RF/RNF) e o modelo de dados.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — atalho rápido de "onde
   mexer para cada tipo de mudança", pra não precisar reler tudo acima toda
   vez.

## Estrutura

```
backend/   API (Node + Express + Prisma + SQLite) — ver backend/README.md
frontend/  PWA (React + Vite + Dexie) — ver frontend/README.md
deploy/    Arquivos e guia de produção — ver deploy/README-DEPLOY.md
docs/      Documentos de produto e arquitetura
```

## Rodando o projeto localmente

Precisa de dois terminais:

```bash
# terminal 1
cd backend
npm install
cp .env.example .env
npm run prisma:migrate
npm run seed
npm run dev            # http://localhost:3000

# terminal 2
cd frontend
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

Login de teste (criado pelo seed): `admin` / `admin123` (perfil admin) ou
`funcionario` / `func123` (perfil funcionário).

> ⚠️ **Essas credenciais valem só em desenvolvimento.** Elas estão publicadas
> aqui, num repositório público — qualquer pessoa as conhece. O `npm run seed`
> se recusa a rodar com `NODE_ENV=production`, e essas senhas são recusadas
> pelo validador se alguém tentar reutilizá-las. Em produção, o usuário dos
> donos é criado por `npm run criar-admin`, com senha digitada por eles.

## Colocando em produção

O passo a passo completo está em
[deploy/README-DEPLOY.md](deploy/README-DEPLOY.md): VPS gratuita com HTTPS,
publicação do PWA, criação segura do usuário dos donos, backup automático e um
checklist de segurança para conferir antes de entregar ao cliente.

## Testes e integração contínua

```bash
cd backend  && npm test        # regras de segurança, sem banco e offline
cd backend  && npm run typecheck
cd frontend && npm test        # sincronização offline, com IndexedDB em memória
cd frontend && npm run build   # o tsc -b faz o typecheck do PWA
```

Os testes do backend (`backend/testes/seguranca.test.ts`) cobrem as regras
que separam este sistema de um sistema aberto: enumeração de usuário no
login, RBAC das rotas de admin, invalidação de sessão (`ativo` e
`tokenVersion`), proteção do último admin, senha provisória que não vira
permanente, força bruta no login, CORS e o erro de banco que antes deixava a
requisição pendurada. Cada teste corresponde a uma brecha que existiu de
verdade neste repositório.

Eles rodam com um Prisma falso em memória (`backend/testes/prismaFalso.ts`),
então não precisam de banco, de engine nativo nem de internet — o que também
os torna baratos de rodar no CI.

No frontend, `frontend/testes/sync.test.ts` cobre a sincronização offline —
a fila de movimentações, a atualização do catálogo e o estoque otimista
mostrado na tela — com um IndexedDB em memória (`fake-indexeddb`), sem
navegador.

O [workflow do GitHub Actions](.github/workflows/ci.yml) roda em todo PR e em
todo push na `main`: testes e typecheck do backend, aplicação das migrations
num SQLite descartável, testes do frontend e build completo do PWA. O badge no
topo mostra o estado da `main`.

## Contribuindo

Nada entra na `main` por commit direto: toda mudança nasce numa branch e entra
por Pull Request com o CI verde. O fluxo, a convenção de nomes e o que um PR
precisa ter estão em [CONTRIBUTING.md](CONTRIBUTING.md).

## Estado atual

MVP definido em docs/especificacao-requisitos.md (RF01–RF16) implementado:
cadastro de produto/categoria, entrada/saída/ajuste de estoque, sincronização
offline, alertas, relatórios, dashboard e histórico. Ainda não testado num
navegador de verdade neste ambiente (sem acesso gráfico) — os próximos
passos antes de considerar isso pronto para o cliente estão no final deste
arquivo.

## Próximos passos

- Testar o fluxo completo num navegador (login → entrada → saída → dashboard)
- Executar o deploy seguindo [deploy/README-DEPLOY.md](deploy/README-DEPLOY.md)
  e testar a instalação real no celular do funcionário (Android e iPhone)
- Definir identidade visual definitiva com o cliente (seção 7 do documento
  de visão)
