# Backend — Estoque Casa do Campo

API em Node + TypeScript + Express + Prisma, banco SQLite (arquivo único).
Ver [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) antes de mexer — tem as
regras de negócio que não podem quebrar.

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run prisma:migrate   # cria o banco (dev.db) e as tabelas
npm run seed              # usuários e produtos de exemplo
npm run dev                # http://localhost:3000
```

Usuários criados pelo seed: `admin` / `admin123` e `funcionario` / `func123`
— **trocar em produção**.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API com reload automático |
| `npm run build` / `npm start` | Build de produção e execução |
| `npm run prisma:migrate` | Cria/atualiza o schema do banco |
| `npm run seed` | Popula usuários e produtos de exemplo |
| `npm run backup` | Copia `dev.db` pra `backups/` com timestamp (RF16) |

## Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Caminho do arquivo SQLite (`file:./dev.db`) |
| `JWT_SECRET` | Segredo de assinatura do token — trocar em produção |
| `PORT` | Porta da API (padrão 3000) |
| `FRONTEND_URL` | Origem liberada no CORS |
| `LIMITE_QUANTIDADE_ONLINE` | RF07 — acima disso, saída exige internet |

## Endpoints

Todas as rotas exceto `/auth/login` e `/health` exigem
`Authorization: Bearer <token>`. Rotas marcadas **(admin)** também exigem
`perfil: "admin"`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | `{ nome, senha }` → `{ token, usuario }` |
| GET | `/config` | Limite de quantidade que exige internet (RF07) |
| GET | `/categorias` | Lista categorias |
| POST/PUT | `/categorias` | Cria/edita categoria |
| GET | `/produtos?busca=texto` | Lista produtos com estoque calculado |
| GET | `/produtos/:id/estoque` | Estoque atual de um produto (checagem RF07) |
| POST/PUT | `/produtos` | Cria/edita produto |
| POST | `/movimentacoes/sync` | Envia lote de movimentações (offline ou online) |
| GET | `/movimentacoes` **(admin)** | Histórico/auditoria (RF13) |
| GET | `/alertas` **(admin)** | Estoque mínimo/negativo (RF09/RF10) |
| GET | `/relatorios/movimentacao-por-produto` **(admin)** | RF11 |
| GET | `/relatorios/valor-total-estoque` **(admin)** | RF12 |
| GET | `/dashboard` **(admin)** | Resumo (RF08) |

## Backup automático em produção

Sem verba pra ferramenta paga de backup — a rotina é um cron simples na VPS:

```cron
0 3 * * * cd /caminho/do/backend && npm run backup
```

Isso copia o banco pra `backups/`. Vale mandar essa pasta pra fora da VPS de
vez em quando (ex: `rsync` pra outra máquina) — um backup que só existe na
mesma máquina do banco original não protege contra a VPS sumir.

## Deploy (VPS gratuita)

Decisão do projeto (seção 5.3/5.4 do documento de visão): self-hosted numa
VPS de camada "sempre grátis" (ex: Oracle Cloud Free Tier), sem Docker
obrigatório — `npm run build && npm start` atrás de um `pm2` ou `systemd`
resolve. Não há esse setup neste repositório ainda; é o próximo passo depois
que o MVP estiver testado localmente.
