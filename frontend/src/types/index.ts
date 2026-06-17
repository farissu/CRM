export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';

export interface Company {
  id: string;
  name: string;
  brand?: string;
  address?: string;
  businessEntities?: string;
  businessType?: string;
  email?: string;
  phone?: string;
  logo?: string;
  webhookUrl?: string;
  webhookCallbackUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  company?: {
    id: string;
    name: string;
  };
  avatar?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  _count?: {
    contacts: number;
  };
}

export interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  labels?: Label[];
}

export type ConversationStatus = 'OPEN' | 'RESOLVED' | 'PENDING';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'STICKER';
export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';

export interface Conversation {
  id: string;
  contactId: string;
  assignedAgentId?: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt: string;
  lastMessageText?: string;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  assignedAgent?: Agent;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  externalId?: string | null;
  direction: MessageDirection;
  text: string | null;
  messageType: MessageType;
  status?: MessageStatus | null;
  senderId?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  sender?: Agent;
  mediaUrl?: string | null;
  mediaType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  caption?: string | null;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
}
