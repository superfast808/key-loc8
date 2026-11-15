#!/usr/bin/env bash
# Full Key-Loc8 database export (PostgreSQL 16, Docker Compose).
# Run from the server hosting the Key-Loc8 repository:
#   bash scripts/export-database.sh
# Optional alternative destination:
#   BACKUP_DIR=/secure/backups bash scripts/export-database.sh
#
# This intentionally excludes active web sessions, matching the GUI export.
# It does not stop the app, change database records, or delete old backups.
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/keyloc8}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed or not on PATH" >&2
  exit 1
fi

# Backups are sensitive: only the invoking account should be able to read them.
mkdir -p -- "${BACKUP_DIR}"
chmod 0700 -- "${BACKUP_DIR}"

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
filename="keyloc8-database-${timestamp}-$$.dump"
destination="${BACKUP_DIR}/${filename}"
temporary="$(mktemp "${BACKUP_DIR}/.${filename}.partial.XXXXXXXX")"

cleanup() {
  if [[ -n "${temporary:-}" ]]; then
    rm -f -- "${temporary}"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd -- "${PROJECT_DIR}"
if [[ -z "$(docker compose ps --status running -q db)" ]]; then
  echo "ERROR: The Compose database service 'db' is not running" >&2
  exit 1
fi

echo "Creating database export to ${destination}"
# pg_dump runs INSIDE the Postgres container. No password is exposed
# in command arguments, on the host, or in the backup filename.
# Docker Compose exec -T is required for binary-safe stdout redirection.
docker compose exec -T db sh -eu -c '
  exec pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-acl \
    --exclude-table-data=public.sessions
' > "${temporary}"

if [[ ! -s "${temporary}" ]]; then
  echo "ERROR: Database export was empty" >&2
  exit 1
fi

# Validate the archive's table of contents before marking it complete.
# A complete restore to a disposable database is still the strongest test.
docker compose exec -T db pg_restore --list < "${temporary}" > /dev/null

# Rename only after successful pg_dump and archive verification.
mv -- "${temporary}" "${destination}"
temporary=""

echo "Verified database export: ${destination}"
du -h -- "${destination}"
