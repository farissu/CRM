import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { presenceService } from '../services/presence.service';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// How long to wait after an agent's last socket disconnects before marking them
// offline — covers page refreshes and brief network blips without flapping status.
const DISCONNECT_GRACE_MS = 10_000;

const connectedSockets = new Map<string, Set<string>>(); // agentId -> connected socket ids
const disconnectTimers = new Map<string, NodeJS.Timeout>(); // agentId -> pending offline timer

function isAgentConnected(agentId: string): boolean {
  return (connectedSockets.get(agentId)?.size ?? 0) > 0;
}

function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Unauthorized'));
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    socket.data.agentId = decoded.id;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}

export function registerPresenceHandlers(io: Server) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const agentId = socket.data.agentId as string;
    const wasOffline = !isAgentConnected(agentId);

    const sockets = connectedSockets.get(agentId) ?? new Set<string>();
    sockets.add(socket.id);
    connectedSockets.set(agentId, sockets);

    const pendingOffline = disconnectTimers.get(agentId);
    if (pendingOffline) {
      clearTimeout(pendingOffline);
      disconnectTimers.delete(agentId);
    }

    if (wasOffline) {
      void presenceService.setStatus(agentId, 'ACTIVE', 'AUTO');
    }

    socket.on('disconnect', () => {
      connectedSockets.get(agentId)?.delete(socket.id);
      if (isAgentConnected(agentId)) return;

      const timer = setTimeout(() => {
        disconnectTimers.delete(agentId);
        if (!isAgentConnected(agentId)) {
          void presenceService.setStatus(agentId, 'OFFLINE', 'AUTO');
        }
      }, DISCONNECT_GRACE_MS);
      disconnectTimers.set(agentId, timer);
    });
  });
}
