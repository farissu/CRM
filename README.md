# WhatsApp CRM Platform

A comprehensive CRM platform for managing WhatsApp conversations with Wappin integration.

## Features

- 🔐 Wappin API authentication with automatic token refresh
- 💬 WhatsApp-style chat interface
- 👥 Agent assignment and management
- 📊 Conversation status tracking
- ⚡ Real-time typing indicators
- 🔔 Unread message counts
- 📝 Message history

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma, Socket.IO
- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Database**: PostgreSQL
- **Cache**: Redis
- **API**: Wappin API integration

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your credentials
3. Start the services:

```bash
docker-compose up
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Environment Variables

See `.env.example` for required configuration.

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

### WebSocket Events
- `typing_start` - Agent starts typing
- `typing_stop` - Agent stops typing
- `message_received` - New message received
- `conversation_updated` - Conversation status changed
