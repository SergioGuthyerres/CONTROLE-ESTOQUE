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

Usuários criados pelo seed: `admin` / `admin123` e `funcionario` / `func123`.
São **exclusivamente de desenvolvimento** — estão publicados neste repositório
público, o seed se recusa a rodar com `NODE_ENV=production` e o validador de
senha as recusa. Em produção, ver `npm run criar-admin` e
[deploy/README-DEPLOY.md](../deploy/README-DEPLOY.md).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API com reload automático |
| `npm run build` / `npm start` | Build de produção e execução |
| `npm test` | Testes das regras de segurança (sessão, permissão, força bruta) |
| `npm run prisma:migrate` | Cria/atualiza o schema do banco (desenvolvimento) |
| `npm run prisma:deploy` | Aplica migrations existentes (produção) |
| `npm run seed` | Popula usuários e produtos de exemplo (só em dev) |
| `npm run criar-admin -- --nome dona.maria` | Cria/reseta o admin dos donos com senha digitada sem eco |
| `npm run backup` | Backup consistente do banco com rotação (RF16) |

Em produção, onde as dependências de desenvolvimento não são instaladas, use as
versões compiladas: `npm run criar-admin:prod` e `npm run backup:prod`.

## Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `NODE_ENV` | `development`, `test` ou `production` — muda validações e logs |
| `DATABASE_URL` | Caminho do arquivo SQLite (absoluto em produção) |
| `JWT_SECRET` | Segredo de assinatura do token; mínimo 32 caracteres, gerar com `openssl rand -base64 48` |
| `PORT` | Porta da API (padrão 3000) |
| `HOST` | Interface de escuta; padrão `127.0.0.1` em produção, `0.0.0.0` em dev |
| `FRONTEND_URL` | Origens liberadas no CORS (separadas por vírgula) |
| `TRUST_PROXY` | `true` quando atrás do Caddy/Nginx — necessário para o rate limit |
| `LIMITE_QUANTIDADE_ONLINE` | RF07 — acima disso, saída exige internet |
| `LOGIN_MAX_TENTATIVAS` / `LOGIN_JANELA_MINUTOS` | Rate limit do login por IP |
| `BACKUP_DIR` / `BACKUP_RETENCAO` | Onde gravar backups e quantos manter |

A configuração é validada na inicialização (`src/lib/env.ts`): a API se recusa a
subir com `JWT_SECRET` curto ou de exemplo, e em produção também exige
`FRONTEND_URL` real e `TRUST_PROXY=true`.

## Autenticação e sessão

O token JWT dura 30 dias (RNF05 — refazer login toda hora é atrito para o
público deste sistema). Como isso é muito tempo para um aparelho perdido, cada
requisição confere no banco se o usuário continua ativo e se a sessão não foi
revogada (`Usuario.ativo` e `Usuario.tokenVersion`, ver `src/middleware/auth.ts`).

Consequências práticas:

- Trocar a senha derruba a sessão nos outros aparelhos; o que fez a troca recebe
  um token novo na própria resposta.
- Desativar ou rebaixar um usuário vale imediatamente, não em 30 dias.
- Usuário com senha provisória (criada ou resetada por um admin) só acessa
  `/auth/eu` e `/auth/trocar-senha` até escolher a própria senha.

## Endpoints

Todas as rotas exceto `/auth/login` e `/health` exigem
`Authorization: Bearer <token>`. Rotas marcadas **(admin)** também exigem
`perfil: "admin"`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | `{ nome, senha }` → `{ token, usuario }` (com rate limit por IP) |
| GET | `/auth/eu` | Confirma se a sessão guardada ainda é válida |
| POST | `/auth/trocar-senha` | `{ senhaAtual, senhaNova }` → token novo; derruba os outros aparelhos |
| GET | `/usuarios` **(admin)** | Lista usuários (RF14) |
| POST | `/usuarios` **(admin)** | Cria usuário e devolve a senha provisória gerada, uma única vez |
| POST | `/usuarios/:id/resetar-senha` **(admin)** | Nova senha provisória; encerra as sessões do usuário |
| PATCH | `/usuarios/:id` **(admin)** | Ativa/desativa ou muda o perfil |
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

Sem verba pra ferramenta paga de backup — a rotina é um cron simples na VPS.
O arquivo pronto está em [deploy/backup.cron](../deploy/backup.cron).

O script **não copia o arquivo do banco**. Copiar um SQLite enquanto a API
escreve produz um backup que pode estar no meio de uma transação, com o pedaço
que falta no arquivo `-wal` que o `cp` não leva junto — parece um backup válido
e só se revela quebrado no dia da restauração. Em vez disso é usado
`VACUUM INTO`, que pede o lock ao próprio SQLite e grava um arquivo íntegro com
a API no ar. O script também apaga os backups mais antigos (`BACKUP_RETENCAO`),
senão o disco da VPS enche e a API para de conseguir escrever.

Vale mandar a pasta pra fora da VPS de vez em quando (ex: `rsync` pra outra
máquina) — um backup que só existe na mesma máquina do banco original não
protege contra a VPS sumir.

## Deploy (VPS gratuita)

Decisão do projeto (seção 5.3/5.4 do documento de visão): self-hosted numa
VPS de camada "sempre grátis" (ex: Oracle Cloud Free Tier), sem Docker
obrigatório — `systemd` para manter a API no ar e Caddy na frente para o HTTPS.

O passo a passo completo, com os arquivos prontos (`estoque-api.service`,
`Caddyfile`, cron de backup e modelo do `.env` de produção), está em
[deploy/README-DEPLOY.md](../deploy/README-DEPLOY.md).
