#!/bin/sh
set -e
echo "=== Starting LexCore Backend ==="
echo "PORT: ${PORT}"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "Running migrations..."
alembic upgrade head
echo "Migrations done. Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
