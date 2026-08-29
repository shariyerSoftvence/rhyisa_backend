#!/bin/sh
set -e

echo "Running Prisma database migrations..."
npx prisma migrate deploy || npx prisma db push

echo "Starting application..."
exec "$@"
