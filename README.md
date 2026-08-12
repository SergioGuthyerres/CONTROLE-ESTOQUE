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

## Estado atual

MVP definido em docs/especificacao-requisitos.md (RF01–RF16) implementado:
cadastro de produto/categoria, entrada/saída/ajuste de estoque, sincronização
offline, alertas, relatórios, dashboard e histórico. Ainda não testado num
navegador de verdade neste ambiente (sem acesso gráfico) — os próximos
passos antes de considerar isso pronto para o cliente estão no final deste
arquivo.

## Próximos passos

- Testar o fluxo completo num navegador (login → entrada → saída → dashboard)
- Deploy do backend numa VPS gratuita (ver backend/README.md, seção Deploy)
- Publicar o frontend em algum host estático gratuito com HTTPS (necessário
  pra PWA funcionar fora de localhost) e testar a instalação real no celular
  do funcionário (Android e iPhone)
- Definir identidade visual definitiva com o cliente (seção 7 do documento
  de visão)
