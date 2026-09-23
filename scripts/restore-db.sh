#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test "$#" = 2 && test "$2" = '--confirm-replace' || { echo 'Uso: sh scripts/restore-db.sh backup.dump --confirm-replace'; exit 1; }
test -f "$1" || { echo 'No existe el backup'; exit 1; }
docker compose exec -T postgres pg_restore --list < "$1" > /dev/null
# Existing information is replaced, atomically. Leave app stopped on failure.
docker compose stop app
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error' < "$1"
docker compose up -d app
