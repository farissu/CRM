#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f backend/.env ]; then
  echo "❌ backend/.env tidak ditemukan."
  echo "   Copy dari backend/.env.example dulu, lalu isi minimal DATABASE_URL/JWT_SECRET."
  exit 1
fi

# Safety guard: this script runs `prisma db push --force-reset`, which wipes the database.
# It must never touch a production database. Refuse to run unless the env clearly points to localhost.
FRONTEND_URL_VALUE="$(grep -E '^FRONTEND_URL=' backend/.env | tail -1 | cut -d '=' -f2-)"
if [ -n "$FRONTEND_URL_VALUE" ] && [[ "$FRONTEND_URL_VALUE" != *"localhost"* ]] && [[ "$FRONTEND_URL_VALUE" != *"127.0.0.1"* ]]; then
  echo "❌ backend/.env terlihat seperti konfigurasi production (FRONTEND_URL=$FRONTEND_URL_VALUE)."
  echo "   Script ini melakukan RESET TOTAL database dan HANYA untuk dev lokal — dibatalkan demi keamanan."
  echo "   Untuk production, ikuti DEPLOYMENT_GUIDE.md (docker-compose.prod.yml + prisma migrate deploy)."
  exit 1
fi

# Make sure the Docker daemon is actually running before touching compose
if ! docker info > /dev/null 2>&1; then
  echo "⏳ Docker daemon belum jalan..."
  if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Docker.app" ]; then
    echo "   Membuka Docker Desktop..."
    open -a Docker
    echo -n "   Menunggu Docker siap"
    until docker info > /dev/null 2>&1; do
      echo -n "."
      sleep 2
    done
    echo " ✅"
  else
    echo "❌ Jalankan Docker Desktop (atau Docker daemon) dulu, lalu ulangi script ini."
    exit 1
  fi
fi

echo "🚀 Starting WhatsApp CRM Platform..."
docker compose up -d --build

echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

echo "⏳ Waiting for Redis..."
until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Redis is ready"

echo "📊 Syncing database schema..."
# --force-reset drops and recreates the schema from scratch. Safe here: this is the local
# dev database (seed data only, no real customers), and makes this script idempotent even
# if a previous run left the schema in a half-applied state.
docker compose exec -T backend npx prisma db push --skip-generate --force-reset --accept-data-loss

echo "🔧 Generating Prisma client..."
docker compose exec -T backend npx prisma generate

echo "🌱 Seeding database..."
docker compose exec -T backend npm run seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Application is running:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "📝 Password login ada di output seed di atas ⬆️  (dicetak sekali saja, catat sekarang)."
echo "   Login pertama akan langsung minta ganti password sebelum bisa masuk dashboard."
