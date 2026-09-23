#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
umask 077
target="backups/critical-spares-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$target.partial"
mv "$target.partial" "$target"
printf 'Backup: %s\nCopiar fuera de esta VM.\n' "$target"
