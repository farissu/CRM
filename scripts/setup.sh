#!/bin/bash

echo "🚀 Starting WhatsApp CRM Platform..."

# Wait for PostgresSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Redis is ready"

# Run Prisma migrations
echo "📊 Running database migrations..."
docker-compose exec -T backend npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
docker-compose exec -T backend npx prisma generate

# Seed database
echo "🌱 Seeding database..."
docker-compose exec -T backend npx ts-node prisma/seed.ts

echo "✅ Setup complete!"
echo ""
echo "🌐 Application is running:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "📝 Default credentials:"
echo "   Email:    admin@example.com"
echo "   Password: admin123"
