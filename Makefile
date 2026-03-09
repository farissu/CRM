.PHONY: help up down logs restart clean setup seed

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

restart: ## Restart all services
	docker-compose restart

clean: ## Stop and remove all containers, volumes, and images
	docker-compose down -v --remove-orphans

setup: ## Initial setup - start services and run migrations
	@echo "🚀 Setting up WhatsApp CRM Platform..."
	docker-compose up -d
	@sleep 10
	@echo "📊 Pushing database schema..."
	docker-compose exec backend npx prisma db push --skip-generate
	@echo "🔧 Generating Prisma client..."
	docker-compose exec backend npx prisma generate
	@echo "🌱 Seeding database..."
	docker-compose exec backend npm run seed
	@echo "✅ Setup complete!"
	@echo ""
	@echo "🌐 Application URLs:"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:3001"

seed: ## Seed the database with sample data
	docker-compose exec backend npm run seed

migrate: ## Run database migrations
	docker-compose exec backend npx prisma migrate dev

prisma-studio: ## Open Prisma Studio
	docker-compose exec backend npx prisma studio

backend-shell: ## Open shell in backend container
	docker-compose exec backend sh

frontend-shell: ## Open shell in frontend container
	docker-compose exec frontend sh

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d whatsapp_crm

redis-cli: ## Open Redis CLI
	docker-compose exec redis redis-cli

install-backend: ## Install backend dependencies
	docker-compose exec backend npm install

install-frontend: ## Install frontend dependencies
	docker-compose exec frontend npm install

build: ## Build all services
	docker-compose build

rebuild: ## Rebuild all services from scratch
	docker-compose build --no-cache
