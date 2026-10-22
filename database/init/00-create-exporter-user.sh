#!/bin/bash
set -euo pipefail

# This script runs directly from /docker-entrypoint-initdb.d. Do not depend on
# docker_process_sql: it is an internal entrypoint helper and is not available
# when this file is executed as a separate process.

if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  echo "MYSQL_ROOT_PASSWORD must be set to initialize the exporter account" >&2
  exit 1
fi

if [[ -z "${MYSQL_EXPORTER_PASSWORD:-}" ]]; then
  echo "MYSQL_EXPORTER_PASSWORD must be set to initialize the exporter account" >&2
  exit 1
fi

# Keep the value safe to embed as a SQL string literal. Hex secrets from
# `openssl rand -hex 32` satisfy this check.
if [[ ! "$MYSQL_EXPORTER_PASSWORD" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "MYSQL_EXPORTER_PASSWORD may contain only letters, numbers, _ and -" >&2
  exit 1
fi

# Use a short-lived, owner-only option file so the root password is not placed
# in mysql's process arguments. The option-file password escapes follow MySQL's
# option-file syntax.
client_defaults="$(mktemp)"
chmod 600 "$client_defaults"
escaped_root_password=${MYSQL_ROOT_PASSWORD//\\/\\\\}
escaped_root_password=${escaped_root_password//\"/\\\"}
printf '[client]\nuser=root\nprotocol=socket\npassword="%s"\n' \
  "$escaped_root_password" > "$client_defaults"

if ! mysql --defaults-extra-file="$client_defaults" --batch --skip-column-names <<SQL
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
SQL
then
  rm -f "$client_defaults"
  exit 1
fi

rm -f "$client_defaults"
