#!/bin/sh
set -eu

psql_args="--host=$PGHOST --port=$PGPORT --username=$PGUSER --dbname=$PGDATABASE --no-psqlrc --set=ON_ERROR_STOP=1"
migrations_dir=${MIGRATIONS_DIR:-/migrations}

psql $psql_args <<'SQL'
CREATE TABLE IF NOT EXISTS stampp_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

find "$migrations_dir" -mindepth 2 -maxdepth 2 -name migration.sql -type f | sort | while read -r migration; do
  name=$(basename "$(dirname "$migration")")
  case "$name" in
    *[!A-Za-z0-9_-]*)
      echo "Migration directory has an invalid name: $name" >&2
      exit 1
      ;;
  esac
  checksum=$(sha256sum "$migration" | cut -d ' ' -f 1)
  # psql --command does not interpolate :'var'; name is validated [A-Za-z0-9_-] above.
  applied_checksum=$(psql $psql_args --tuples-only --no-align \
    --command="SELECT checksum FROM stampp_migrations WHERE name = '$name'")

  if [ -n "$applied_checksum" ]; then
    if [ "$applied_checksum" != "$checksum" ]; then
      echo "Migration $name changed after it was applied." >&2
      exit 1
    fi
    continue
  fi

  {
    cat "$migration"
    printf "\nINSERT INTO stampp_migrations (name, checksum) VALUES ('%s', '%s');\n" "$name" "$checksum"
  } | psql $psql_args --single-transaction
done
