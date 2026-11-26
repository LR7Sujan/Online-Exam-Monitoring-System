#!/usr/bin/env bash
# ============================================================================
# ProctorIQ: Create, Migrate, and Seed MySQL 8.0+ in One Command
# Supports local mysql CLI or Node migration runner.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-proctoriq_root}"

run_sql_file() {
  local file="$1"
  echo "[db/run.sh] Executing $(basename "$file")..."
  if command -v mysql >/dev/null 2>&1; then
    MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" < "$file"
  else
    echo "[db/run.sh] Falling back to Node runner: npm --prefix server run db:init" >&2
    npm --prefix "${ROOT_DIR}/server" run db:init
    exit 0
  fi
}

for migration in "${SCRIPT_DIR}/migrations/"*.sql; do
  run_sql_file "$migration"
done

run_sql_file "${SCRIPT_DIR}/seed.sql"

echo "[db/run.sh] Database created, migrated, and seeded successfully."

