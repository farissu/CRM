import { io, Socket } from 'socket.io-client';
import type { Message, Conversation, MessageStatus } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

class SocketClient {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave_conversation', conversationId);
  }

  sendTypingStart(conversationId: string, agentName: string) {
    this.socket?.emit('typing_start', { conversationId, agentName });
  }

  sendTypingStop(conversationId: string) {
    this.socket?.emit('typing_stop', { conversationId });
  }

  // `off*` takes the same callback reference passed to the matching `on*` so it only
  // removes that one listener — `socket.off(event)` with no handler wipes every listener
  // for that event on this shared singleton, which would clobber other components still
  // listening (e.g. a list view and a detail view both subscribed to the same event).

  onMessageReceived(callback: (data: { conversationId: string; message: Message }) => void) {
    this.socket?.on('message_received', callback);
  }

  onConversationUpdated(callback: (conversation: Conversation) => void) {
    this.socket?.on('conversation_updated', callback);
  }

  onTypingStart(callback: (data: { conversationId: string; agentName: string }) => void) {
    this.socket?.on('typing_start', callback);
  }

  onTypingStop(callback: (data: { conversationId: string }) => void) {
    this.socket?.on('typing_stop', callback);
  }

  onBroadcastUpdated(callback: (data: { broadcastId: string }) => void) {
    this.socket?.on('broadcast_updated', callback);
  }

  onMessageStatusUpdated(callback: (data: { messageId: string; status: MessageStatus }) => void) {
    this.socket?.on('message_status_updated', callback);
  }

  onMessageReactionUpdated(callback: (data: { conversationId: string; message: Message }) => void) {
    this.socket?.on('message_reaction_updated', callback);
  }

  offMessageReceived(callback: (data: { conversationId: string; message: Message }) => void) {
    this.socket?.off('message_received', callback);
  }

  offConversationUpdated(callback: (conversation: Conversation) => void) {
    this.socket?.off('conversation_updated', callback);
  }

  offTypingStart(callback: (data: { conversationId: string; agentName: string }) => void) {
    this.socket?.off('typing_start', callback);
  }

  offTypingStop(callback: (data: { conversationId: string }) => void) {
    this.socket?.off('typing_stop', callback);
  }

  offBroadcastUpdated(callback: (data: { broadcastId: string }) => void) {
    this.socket?.off('broadcast_updated', callback);
  }

  offMessageStatusUpdated(callback: (data: { messageId: string; status: MessageStatus }) => void) {
    this.socket?.off('message_status_updated', callback);
  }

  offMessageReactionUpdated(callback: (data: { conversationId: string; message: Message }) => void) {
    this.socket?.off('message_reaction_updated', callback);
  }
}

export const socketClient = new SocketClient();
