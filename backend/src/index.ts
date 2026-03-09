import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { wappinAuthService } from './services/wappin-auth.service';
import routes from './routes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create Socket.IO server
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join conversation room
  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave conversation room
  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  // Typing indicator - start
  socket.on('typing_start', (data: { conversationId: string; agentName: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing_start', {
      conversationId: data.conversationId,
      agentName: data.agentName
    });
    console.log(`Typing started in conversation ${data.conversationId} by ${data.agentName}`);
  });

  // Typing indicator - stop
  socket.on('typing_stop', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing_stop', {
      conversationId: data.conversationId
    });
    console.log(`Typing stopped in conversation ${data.conversationId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize and start server
async function start() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Initialize Wappin authentication
    await wappinAuthService.initialize();

    // Start server
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🔗 API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the application
start();
