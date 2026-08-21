# Estoque Casa do Campo

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

Testes das regras de segurança (sessão, permissão, força bruta, senha
provisória):

```bash
cd backend && npm test
```

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
