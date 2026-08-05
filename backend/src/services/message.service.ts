import { MessageDirection, MessageType, MessageStatus } from '@prisma/client';
import axios from 'axios';
import prisma from '../config/database';
import { whatsAppService } from './whatsapp.service';
import { conversationService } from './conversation.service';
import { storageService } from './storage.service';
import { io } from '../index';
import { broadcastService } from './broadcast.service';

function resolveOutboundMediaUrl(mediaUrl?: string): Promise<string | undefined> {
  if (!mediaUrl) return Promise.resolve(undefined);
  if (mediaUrl.startsWith('http')) return Promise.resolve(mediaUrl);
  return storageService.getSignedUrl(mediaUrl);
}

const WEBHOOK_TYPE_MAP: Record<string, MessageType> = {
  text:     MessageType.TEXT,
  image:    MessageType.IMAGE,
  video:    MessageType.VIDEO,
  document: MessageType.DOCUMENT,
  audio:    MessageType.AUDIO,
  sticker:  MessageType.STICKER,
};

function toMessageType(s?: string): MessageType {
  return (s ? WEBHOOK_TYPE_MAP[s] : undefined) ?? MessageType.TEXT;
}

interface SendMessageParams {
  conversationId: string;
  text?: string;
  senderId: string;
  messageType?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  caption?: string;
  buttonText?: string;
  buttonUrl?: string;
}

interface ReceiveMessageParams {
  phoneNumber: string;
  text?: string;
  contactName?: string;
  timestamp?: Date;
  messageType?: string;
  externalId?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  caption?: string;
}

export class MessageService {
  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          timestamp: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.message.count({ where: { conversationId } })
    ]);

    return {
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Send outbound message from a dashboard agent (existing conversation, JWT-authenticated)
   */
  async sendMessage(params: SendMessageParams) {
    const conversation = await conversationService.getConversationById(params.conversationId);
    return this.sendToConversation(conversation, params);
  }

  /**
   * Send outbound message from an external integration (API key auth), identified by
   * phone number instead of an existing conversationId — finds or creates the
   * conversation/contact so the message shows up in the dashboard like any other.
   */
  async sendMessageByPhone(params: {
    phoneNumber: string;
    text: string;
    contactName?: string;
    messageType?: string;
    buttonText?: string;
    buttonUrl?: string;
  }) {
    const conversation = await conversationService.getOrCreateConversation(params.phoneNumber, params.contactName);
    return this.sendToConversation(conversation, {
      conversationId: conversation.id,
      text: params.text,
      senderId: undefined as unknown as string,
      messageType: params.messageType,
      buttonText: params.buttonText,
      buttonUrl: params.buttonUrl,
    });
  }

  private async sendToConversation(
    conversation: { id: string; contact: { phoneNumber: string } },
    params: SendMessageParams
  ) {
    const { conversationId, text, senderId, messageType, mediaUrl, mediaType, fileName, fileSize, caption, buttonText, buttonUrl } = params;

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.OUTBOUND,
        text: text || caption,
        messageType: toMessageType(messageType),
        status: MessageStatus.SENDING,
        senderId,
        mediaUrl,
        mediaType,
        fileName,
        fileSize,
        caption
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Send via WhatsApp Cloud API
    try {
      const outboundMediaUrl = await resolveOutboundMediaUrl(mediaUrl);
      const waMessageId = await whatsAppService.sendMessage({
        to: conversation.contact.phoneNumber,
        text: text || caption,
        messageType: messageType || 'text',
        mediaUrl: outboundMediaUrl,
        caption,
        fileName,
        buttonText,
        buttonUrl
      });

      // Update message status
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.SENT,
          metadata: {
            waMessageId,
            ...(buttonUrl && { interactive: { type: 'cta_url', buttonText, buttonUrl } })
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Update conversation last message
      const lastMessageText = messageType && messageType !== 'text'
        ? (caption || text || `📎 ${messageType}`)
        : (text || caption || '');
      await conversationService.updateLastMessage(conversationId, lastMessageText);

      // Emit socket event
      io.emit('message_received', {
        conversationId,
        message: updatedMessage
      });

      return updatedMessage;
    } catch (error) {
      // Update message status to failed
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED
        }
      });

      if (axios.isAxiosError(error)) {
        console.error('[WhatsApp] Send failed:', JSON.stringify(error.response?.data ?? error.message));
      } else {
        console.error('[WhatsApp] Send failed:', error);
      }

      throw error;
    }
  }

  /**
   * Receive inbound message (from webhook)
   */
  async receiveMessage(params: ReceiveMessageParams) {
    const { phoneNumber, text, contactName, timestamp, messageType, externalId, mediaUrl, mediaType, fileName, fileSize, caption } = params;

    // Deduplication: skip if we already processed this WhatsApp message
    if (externalId) {
      const existing = await prisma.message.findUnique({ where: { externalId } });
      if (existing) return existing;
    }

    // Get or create conversation
    const conversation = await conversationService.getOrCreateConversation(phoneNumber, contactName);

    const resolvedType = toMessageType(messageType);

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalId,
        direction: MessageDirection.INBOUND,
        text: text || caption,
        messageType: resolvedType,
        status: MessageStatus.RECEIVED,
        timestamp: timestamp ?? new Date(),
        mediaUrl,
        mediaType,
        fileName,
        fileSize,
        caption
      }
    });

    // Update conversation
    const lastMessageText = resolvedType !== MessageType.TEXT
      ? `📎 ${messageType}`
      : (text || caption || '');
    await conversationService.updateLastMessage(conversation.id, lastMessageText);
    await conversationService.incrementUnreadCount(conversation.id);

    // Emit socket event
    io.emit('message_received', {
      conversationId: conversation.id,
      message
    });

    return message;
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: MessageStatus) {
    const message = await prisma.message.update({
      where: { id: messageId },
      data: { status }
    });

    // Emit socket event
    io.emit('message_status_updated', {
      messageId,
      status
    });

    return message;
  }

  /**
   * Update message status by WhatsApp message ID (from a delivery status webhook)
   */
  async updateMessageStatusByWaId(waMessageId: string, status: MessageStatus, errorReason?: string) {
    const message = await prisma.message.findFirst({
      where: { metadata: { path: ['waMessageId'], equals: waMessageId } },
    });
    if (!message) return null;
    const updated = await this.updateMessageStatus(message.id, status);

    try {
      await broadcastService.onMessageStatusUpdated(message.id, status, errorReason);
    } catch (err: unknown) {
      console.error('[Broadcast] Failed to update recipient status from webhook:', err);
    }

    return updated;
  }
}

export const messageService = new MessageService();
