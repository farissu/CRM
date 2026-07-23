import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  text: z.string().min(1, 'text is required'),
  senderId: z.string().min(1, 'senderId is required'),
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
