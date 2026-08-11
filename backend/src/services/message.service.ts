import { MessageDirection, MessageType, MessageStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import prisma from '../config/database';
import { whatsAppService } from './whatsapp.service';
import { conversationService } from './conversation.service';
import { storageService } from './storage.service';
import { mediaService } from './media.service';
import { io } from '../index';
import { broadcastService } from './broadcast.service';

function resolveOutboundMediaUrl(mediaUrl?: string): Promise<string | undefined> {
  if (!mediaUrl) return Promise.resolve(undefined);
  if (mediaUrl.startsWith('http')) return Promise.resolve(mediaUrl);
  return storageService.getSignedUrl(mediaUrl);
}

const WEBHOOK_TYPE_MAP: Record<string, MessageType> = {
  text:                MessageType.TEXT,
  image:               MessageType.IMAGE,
  video:               MessageType.VIDEO,
  document:            MessageType.DOCUMENT,
  audio:               MessageType.AUDIO,
  sticker:             MessageType.STICKER,
  interactive_buttons: MessageType.IMAGE,
};

function toMessageType(s?: string): MessageType {
  return (s ? WEBHOOK_TYPE_MAP[s] : undefined) ?? MessageType.TEXT;
}

interface MessageReaction {
  emoji: string;
  by: 'AGENT' | 'CONTACT';
  agentName?: string;
}

interface QuickReplyButton {
  id: string;
  title: string;
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
  buttons?: QuickReplyButton[];
  quotedMessageId?: string;
}

const MESSAGE_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  quotedMessage: {
    select: {
      id: true,
      text: true,
      caption: true,
      messageType: true,
      direction: true,
      sender: { select: { id: true, name: true } }
    }
  }
} as const;

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
  quotedExternalId?: string;
}

export class MessageService {
  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    // Page through from the newest message backward so page 1 always contains
    // the most recent activity (what a chat UI should open on), then reverse
    // back to chronological order for display.
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: MESSAGE_INCLUDE,
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.message.count({ where: { conversationId } })
    ]);

    return {
      messages: messages.reverse(),
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
    text?: string;
    contactName?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    fileName?: string;
    buttonText?: string;
    buttonUrl?: string;
    buttons?: QuickReplyButton[];
  }) {
    const conversation = await conversationService.getOrCreateConversation(params.phoneNumber, params.contactName);
    return this.sendToConversation(conversation, {
      conversationId: conversation.id,
      text: params.text,
      senderId: undefined as unknown as string,
      messageType: params.messageType,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
      caption: params.caption,
      fileName: params.fileName,
      buttonText: params.buttonText,
      buttonUrl: params.buttonUrl,
      buttons: params.buttons,
    });
  }

  private async sendToConversation(
    conversation: { id: string; contact: { phoneNumber: string } },
    params: SendMessageParams
  ) {
    const { conversationId, text, senderId, messageType, fileName, fileSize, caption, buttonText, buttonUrl, buttons, quotedMessageId } = params;

    // External URLs (e.g. a payment gateway's QR image) get archived into our
    // own storage instead of being sent to WhatsApp straight from the source,
    // so the media stays available even if the source link later expires.
    const externalMedia = params.mediaUrl?.startsWith('http')
      ? await mediaService.downloadFromUrlAndSave(params.mediaUrl, params.mediaType)
      : null;
    const mediaUrl = externalMedia?.objectPath ?? params.mediaUrl;
    const mediaType = externalMedia?.mimeType ?? params.mediaType;

    const quotedMessage = quotedMessageId
      ? await prisma.message.findUnique({ where: { id: quotedMessageId }, select: { externalId: true } })
      : null;

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
        caption,
        quotedMessageId
      },
      include: MESSAGE_INCLUDE
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
        buttonUrl,
        buttons,
        quotedExternalId: quotedMessage?.externalId ?? undefined
      });

      const interactiveMetadata = buttonUrl
        ? { type: 'cta_url', buttonText: buttonText ?? null, buttonUrl }
        : buttons?.length
        ? { type: 'buttons', buttons }
        : undefined;

      // Update message status
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.SENT,
          metadata: {
            waMessageId,
            ...(interactiveMetadata && { interactive: interactiveMetadata })
          } as Prisma.InputJsonValue
        },
        include: MESSAGE_INCLUDE
      });

      // Update conversation last message
      const lastMessageText = messageType && messageType !== 'text'
        ? (caption || text || `📎 ${messageType}`)
        : (text || caption || '');
      await conversationService.updateLastMessage(conversationId, lastMessageText);
      // A reply just went out (manual or automated/external) — nothing is left pending.
      await conversationService.markAsRead(conversationId);

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
    const { phoneNumber, text, contactName, timestamp, messageType, externalId, mediaUrl, mediaType, fileName, fileSize, caption, quotedExternalId } = params;

    // Deduplication: skip if we already processed this WhatsApp message
    if (externalId) {
      const existing = await prisma.message.findUnique({ where: { externalId }, include: MESSAGE_INCLUDE });
      if (existing) return existing;
    }

    // Get or create conversation
    const conversation = await conversationService.getOrCreateConversation(phoneNumber, contactName);

    const resolvedType = toMessageType(messageType);

    const quotedMessage = quotedExternalId
      ? await prisma.message.findUnique({ where: { externalId: quotedExternalId }, select: { id: true } })
      : null;

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
        caption,
        quotedMessageId: quotedMessage?.id
      },
      include: MESSAGE_INCLUDE
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

  /**
   * Agent reacts to a message with an emoji (or removes their reaction with emoji: '').
   * Sends a real WhatsApp reaction to the customer and stores it on the message.
   */
  async reactToMessage(messageId: string, emoji: string, agent: { id: string; name: string }) {
    const message = await prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: { conversation: { include: { contact: true } } },
    });

    const waMessageId = message.externalId || (message.metadata as { waMessageId?: string } | null)?.waMessageId;
    if (!waMessageId) {
      throw new Error('This message cannot be reacted to (no WhatsApp message id on record)');
    }

    await whatsAppService.sendReaction(message.conversation.contact.phoneNumber, waMessageId, emoji);

    const reactions: MessageReaction[] = ((message.reactions as MessageReaction[] | null) ?? [])
      .filter(r => r.by !== 'AGENT');
    if (emoji) reactions.push({ emoji, by: 'AGENT', agentName: agent.name });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { reactions: reactions as unknown as Prisma.InputJsonValue },
      include: MESSAGE_INCLUDE,
    });

    io.emit('message_reaction_updated', { conversationId: message.conversationId, message: updated });
    return updated;
  }

  /**
   * Apply an inbound reaction from a customer (webhook `type: reaction`) to the
   * message it targets, instead of creating a separate chat bubble for it.
   */
  async applyInboundReaction(targetExternalId: string, emoji: string) {
    const message = await prisma.message.findUnique({ where: { externalId: targetExternalId } });
    if (!message) return null;

    const reactions: MessageReaction[] = ((message.reactions as MessageReaction[] | null) ?? [])
      .filter(r => r.by !== 'CONTACT');
    if (emoji) reactions.push({ emoji, by: 'CONTACT' });

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { reactions: reactions as unknown as Prisma.InputJsonValue },
      include: MESSAGE_INCLUDE,
    });

    io.emit('message_reaction_updated', { conversationId: message.conversationId, message: updated });
    return updated;
  }
}

export const messageService = new MessageService();
