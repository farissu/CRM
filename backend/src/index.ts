import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { connectDatabase } from './config/database';
import routes from './routes';
import './workers/broadcast.worker';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
// Trust the first hop (Nginx reverse proxy) so req.ip reflects the real client IP
// from X-Forwarded-For instead of the proxy's address.
app.set('trust proxy', 1);
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.FRONTEND_URL_NGROK,
].filter(Boolean) as string[];

// Create Socket.IO server
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve uploaded media files — JWT required
app.use('/uploads', (req, res, next) => {
  const token = (req.query.token as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}, express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing_start', (data: { conversationId: string; agentName: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing_start', {
      conversationId: data.conversationId,
      agentName: data.agentName
    });
  });

  socket.on('typing_stop', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing_stop', {
      conversationId: data.conversationId
    });
  });
});

// Error handling middleware
app.use((err: { status?: number; message?: string }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Initialize and start server
async function start() {
  try {
    // Connect to databases
    await connectDatabase();

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
