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
  mustChangePassword?: boolean;
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
  metadata?: {
    interactive?: { buttonText?: string; buttonUrl?: string };
  } | null;
}

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: { header_handle?: string[] };
  buttons?: TemplateButton[];
}

export interface MessageTemplate {
  id: string;
  companyId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  metaTemplateId?: string | null;
  components: TemplateComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  type: string;
  url: string;
}

export type BroadcastStatus =
  | 'SCHEDULED'
  | 'PREPARING'
  | 'ON_QUEUE'
  | 'SENDING'
  | 'FINISHED'
  | 'UNFINISHED'
  | 'FAILED'
  | 'CANCELED';

export type BroadcastAudienceType = 'SINGLE_NUMBER' | 'CSV' | 'CONDITION';
export type BroadcastRecipientStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface BroadcastRecipient {
  id: string;
  broadcastId: string;
  phoneNumber: string;
  name?: string | null;
  variables?: Record<string, string> | null;
  status: BroadcastRecipientStatus;
  messageId?: string | null;
  message?: { metadata?: { waMessageId?: string } | null } | null;
  error?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface Broadcast {
  id: string;
  companyId: string;
  name: string;
  label?: string | null;
  templateId: string;
  template?: { name: string; category: TemplateCategory };
  audienceType: BroadcastAudienceType;
  status: BroadcastStatus;
  scheduledAt?: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  recipients?: BroadcastRecipient[];
}

export interface BroadcastsResponse {
  broadcasts: Broadcast[];
  total: number;
  page: number;
  totalPages: number;
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
