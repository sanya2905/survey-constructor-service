#!/bin/sh
set -e

PGHOST=${POSTGRES_HOST:-survey-db}
PGPORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-survey}
POSTGRES_DB=${POSTGRES_DB:-survey_db}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-survey}

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Waiting for PostgreSQL at $PGHOST:$PGPORT..."
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "Postgres unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready, starting API"
exec uvicorn app.main:app --host=0.0.0.0 --port=8000
