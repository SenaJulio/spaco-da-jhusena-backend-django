#!/usr/bin/env bash
set -euo pipefail

# Carrega variáveis do .env.backup (se existir)
ENV_FILE="${ENV_FILE:-.env.backup}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi


# pg_dump (Windows / Linux)
PG_DUMP="${PG_DUMP:-pg_dump}"

if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
  PG_DUMP="/c/Program Files/PostgreSQL/18/bin/pg_dump.exe"
fi

# Exemplo de uso:
# export DATABASE_URL="postgresql://USER:SENHA@HOST:5432/DB?sslmode=require"
# ./tools/backup_db.sh

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${OUT_DIR:-backups}"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: Defina DATABASE_URL antes de rodar."
  exit 1
fi

FILE_SQL="$OUT_DIR/backup_${TS}.sql"
FILE_GZ="${FILE_SQL}.gz"

echo "[backup] Gerando dump em $FILE_SQL ..."
"$PG_DUMP" "$DATABASE_URL" > "$FILE_SQL"

echo "[backup] Compactando em $FILE_GZ ..."
gzip -f "$FILE_SQL"

echo "[backup] OK ✅  -> $FILE_GZ"
ls -lh "$FILE_GZ"

# Retenção: mantém só os últimos N backups
KEEP="${KEEP:-14}"

echo "[backup] Retenção: mantendo últimos $KEEP backups..."
ls -1t "$OUT_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
echo "[backup] Retenção OK ✅"
