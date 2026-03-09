# WhatsApp CRM Platform - Quick Start Guide

This guide will help you get the WhatsApp CRM platform up and running.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development without Docker)
- Wappin API credentials

## Quick Start with Docker (Recommended)

### 1. Clone and Configure

```bash
# Navigate to the project directory
cd /Users/farissu/Documents/startup

# Copy environment variables
cp .env.example .env

# Edit .env and add your Wappin credentials
# Required variables:
# - WAPPIN_USERNAME
# - WAPPIN_PASSWORD
# - JWT_SECRET (any random string)
```

### 2. Start the Platform

```bash
# Using Docker Compose directly
docker-compose up -d

# Wait for services to be ready (about 30 seconds)
# Then run the setup
make setup

# OR using Makefile (easier)
make up
make setup
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 4. Default Credentials

- **Email**: admin@example.com
- **Password**: admin123

## Manual Setup (Without Docker)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp ../.env.example .env
# Edit .env with your configuration

# Set up database (requires PostgreSQL running)
npx prisma migrate dev
npx prisma generate
npm run seed

# Start development server
npm run dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Available Commands

```bash
make help              # Show all available commands
make up                # Start all services
make down              # Stop all services
make logs              # View logs
make restart           # Restart services
make clean             # Remove all containers and volumes
make setup             # Initial setup with migrations and seed
make seed              # Seed database with sample data
make migrate           # Run database migrations
make prisma-studio     # Open Prisma Studio
make backend-shell     # Open shell in backend container
make frontend-shell    # Open shell in frontend container
make db-shell          # Open PostgreSQL shell
make redis-cli         # Open Redis CLI
```

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Database and Redis configuration
│   │   ├── services/        # Business logic (Wappin, Conversation, Message)
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API routes
│   │   └── index.ts         # Main application entry
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Database seed data
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   ├── components/      # React components
│   │   │   ├── sidebar/     # Conversation sidebar
│   │   │   └── chat/        # Chat UI components
│   │   ├── lib/             # API and Socket.IO clients
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # Global styles
│   └── package.json
└── docker-compose.yml       # Docker services configuration
```

## Features

### ✅ Implemented Features

1. **Wappin Authentication**
   - Automatic login on backend start
   - Token caching in Redis
   - Auto-refresh before expiration

2. **Message Management**
   - Send messages via Wappin API
   - Receive inbound messages (webhook)
   - Message status tracking

3. **Conversation Management**
   - List all conversations
   - Filter by status (open/resolved)
   - Assign agents to conversations
   - Mark conversations as resolved
   - Unread message count

4. **Real-time Features**
   - WebSocket integration
   - Typing indicators
   - Live message updates
   - Conversation updates

5. **UI Components**
   - WhatsApp-style chat interface
   - Conversation sidebar with preview
   - Message bubbles (inbound/outbound)
   - Message input with typing detection
   - Unread badges
   - Status indicators

## API Endpoints

### Conversations

- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details
- `PATCH /api/conversations/:id/assign` - Assign agent
- `PATCH /api/conversations/:id/resolve` - Resolve conversation
- `PATCH /api/conversations/:id/read` - Mark as read

### Messages

- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/messages` - Send message
- `POST /api/messages/webhooks/wappin` - Wappin webhook endpoint

## WebSocket Events

### Client → Server

- `join_conversation` - Join a conversation room
- `leave_conversation` - Leave a conversation room
- `typing_start` - Notify typing started
- `typing_stop` - Notify typing stopped

### Server → Client

- `message_received` - New message received
- `conversation_updated` - Conversation updated
- `typing_start` - Agent started typing
- `typing_stop` - Agent stopped typing
- `message_status_updated` - Message status changed

## Troubleshooting

### Services won't start

```bash
# Check logs
make logs

# Clean and rebuild
make clean
docker-compose build --no-cache
make up
```

### Database issues

```bash
# Reset database
make down
docker volume rm startup_postgres_data
make up
make setup
```

### Redis connection issues

```bash
# Check Redis
make redis-cli
# Type: PING
# Expected response: PONG
```

### Frontend can't connect to backend

- Ensure backend is running: http://localhost:3001/health
- Check NEXT_PUBLIC_API_URL in docker-compose.yml
- Check browser console for CORS errors

## Development Tips

### Watch logs in real-time

```bash
# All services
make logs

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Database management

```bash
# Open Prisma Studio (GUI for database)
make prisma-studio

# Or direct database access
make db-shell
```

### Testing Wappin integration

1. Set valid Wappin credentials in `.env`
2. Check backend logs for authentication success
3. Send a test message from the UI
4. Monitor backend logs for API calls

### Adding new features

1. Backend: Update Prisma schema → migrate → regenerate client
2. Frontend: Create components → update API client → integrate
3. Test with WebSocket events for real-time features

## Production Deployment

### Environment Variables

Ensure all production values are set:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
WAPPIN_USERNAME=your_production_username
WAPPIN_PASSWORD=your_production_password
JWT_SECRET=strong_random_secret
FRONTEND_URL=https://your-domain.com
```

### Build for production

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

## Support

For issues or questions:
1. Check logs: `make logs`
2. Review this guide
3. Check Docker service status: `docker-compose ps`
4. Verify environment variables in `.env`

---

**Happy coding! 🚀**
