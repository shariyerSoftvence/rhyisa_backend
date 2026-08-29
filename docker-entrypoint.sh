#!/bin/sh
set -e

# Set default DATABASE_URL for Docker network if not set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://rhisya-user:rhisya@postgres_db:5432/rhisya-db?schema=public"
fi

echo "Running Prisma database migrations..."
npx prisma migrate deploy || npx prisma db push

echo "Starting application..."
exec "$@"
