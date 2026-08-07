import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const sendMessageSchema = z
  .object({
    conversationId: z.string().min(1, 'conversationId is required'),
    text: z.string().optional(),
    senderId: z.string().min(1, 'senderId is required'),
    messageType: z.enum(['text', 'image', 'video', 'document', 'audio']).optional(),
    mediaUrl: z.string().min(1).optional(),
    mediaType: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    caption: z.string().optional(),
    quotedMessageId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.text?.trim()) || Boolean(data.mediaUrl), {
    message: 'text or mediaUrl is required',
    path: ['text'],
  });

export const sendExternalMessageSchema = z.object({
  to: z.string().min(1, 'to is required'),
  text: z.string().min(1, 'text is required'),
  contactName: z.string().optional(),
});

export const reactMessageSchema = z.object({
  emoji: z.string().max(8, 'emoji must be a single emoji'),
});

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a hex value e.g. #FF0000'),
});

export const updateLabelSchema = createLabelSchema.partial();

export const assignLabelSchema = z.object({
  contactId: z.string().min(1),
  labelId: z.string().min(1),
});

export const createQuickReplySchema = z.object({
  title: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
  isActive: z.boolean().optional(),
});

export const updateQuickReplySchema = createQuickReplySchema.partial();

export const assignLabelByPhoneSchema = z.object({
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
  labelId: z.string().min(1, 'labelId is required'),
});

export const createAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT']).optional(),
  companyId: z.string().optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT']).optional(),
  companyId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const createComplaintSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  type: z.string().min(1, 'type is required'),
});

export const createComplaintExternalSchema = z.object({
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
  name: z.string().optional(),
  type: z.string().min(1, 'type is required'),
});
