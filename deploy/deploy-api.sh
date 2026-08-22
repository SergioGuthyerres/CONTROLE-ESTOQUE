#!/usr/bin/env bash
#
# Atualiza a API para o último commit da main. Instalado no servidor como
# /usr/local/bin/deploy-estoque e disparado pelo GitHub Actions por SSH — ver
# a seção "Deploy automático da API" em README-DEPLOY.md.
#
# É o ÚNICO comando que a chave de deploy consegue executar (forced command no
# authorized_keys), então ele não aceita argumento nenhum: qualquer coisa que
# venha pelo SSH é ignorada de propósito. Uma chave vazada não vira shell.
#
# Roda como o usuário "estoque". A única coisa que precisa de root é reiniciar
# o serviço, liberada nominalmente no sudoers (ver estoque-deploy.sudoers).

set -euo pipefail

REPO=/opt/estoque
BACKEND="$REPO/backend"
ARQUIVO_ENV=/etc/estoque/api.env
SERVICO=estoque-api
SAUDE=http://127.0.0.1:3000/health
TENTATIVAS_SAUDE=20

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# Dois merges seguidos na main disparam dois deploys. Sem trava, o segundo
# pega o repositório no meio do npm ci do primeiro.
exec 9>/tmp/deploy-estoque.lock
if ! flock -n 9; then
  log "outro deploy em andamento — saindo sem fazer nada"
  exit 0
fi

carregar_env() {
  set -a
  # shellcheck disable=SC1090
  . "$ARQUIVO_ENV"
  set +a
}

esperar_saude() {
  for _ in $(seq "$TENTATIVAS_SAUDE"); do
    if curl -fsS --max-time 2 "$SAUDE" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

publicar() {
  log "instalando dependências"
  npm ci --prefix "$BACKEND" --silent

  log "compilando"
  npm run build --prefix "$BACKEND" --silent

  log "aplicando migrations"
  (cd "$BACKEND" && carregar_env && npx prisma migrate deploy)

  log "reiniciando o serviço"
  sudo systemctl restart "$SERVICO"
}

cd "$REPO"

ANTERIOR="$(git rev-parse HEAD)"
git fetch --quiet origin main
ALVO="$(git rev-parse origin/main)"

if [ "$ANTERIOR" = "$ALVO" ]; then
  log "já está em $(git rev-parse --short HEAD) — nada a fazer"
  exit 0
fi

log "atualizando de $(git rev-parse --short "$ANTERIOR") para $(git rev-parse --short "$ALVO")"

# Backup ANTES de qualquer coisa, com o código que está funcionando agora.
# O banco é um arquivo SQLite e as migrations são escritas à mão: se uma delas
# estiver errada, este arquivo é o caminho de volta (VACUUM INTO, não cp — ver
# backend/src/scripts/backup.ts).
log "backup do banco"
(cd "$BACKEND" && carregar_env && npm run backup:prod --silent)

# reset --hard, não pull: /opt/estoque é alvo de deploy, não área de trabalho.
# Se alguém editou um arquivo direto no servidor, um pull pararia num conflito
# no meio da noite; o reset descarta e segue, e o que foi editado à mão ali
# nunca deveria existir.
git reset --hard --quiet "$ALVO"

if publicar && esperar_saude; then
  log "no ar em $(git rev-parse --short HEAD)"
  exit 0
fi

log "ERRO: a API não respondeu em $SAUDE — voltando para $(git rev-parse --short "$ANTERIOR")"

# O rollback devolve o CÓDIGO. Ele não desfaz migration: no SQLite não existe
# "migrate down" confiável, e desfazer schema com dado dentro é como se perde
# dado de verdade. Se a migration for a causa, o caminho é o backup feito ali
# em cima, restaurado à mão — está documentado no README-DEPLOY.
git reset --hard --quiet "$ANTERIOR"

if publicar && esperar_saude; then
  log "rollback concluído — a versão anterior está no ar"
else
  log "ERRO: o rollback também não subiu. Ver: journalctl -u $SERVICO -n 50"
fi

exit 1
