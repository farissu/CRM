import prisma from '../config/database';
import { wappinService } from './wappin.service';
import { conversationService } from './conversation.service';
import { io } from '../index';

interface SendMessageParams {
  conversationId: string;
  text: string;
  senderId: string;
}

interface ReceiveMessageParams {
  phoneNumber: string;
  text: string;
  contactName?: string;
  timestamp?: Date;
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
   * Send outbound message
   */
  async sendMessage(params: SendMessageParams) {
    const { conversationId, text, senderId } = params;

    // Get conversation with contact info
    const conversation = await conversationService.getConversationById(conversationId);

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction: 'outbound',
        text,
        messageType: 'text',
        status: 'sending',
        senderId
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

    // Send via Wappin API
    try {
      const wappinMessageId = await wappinService.sendMessage({
        to: conversation.contact.phoneNumber,
        text,
        agentId: senderId
      });

      // Update message status
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'sent',
          metadata: { wappinMessageId }
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
      await conversationService.updateLastMessage(conversationId, text);

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
          status: 'failed'
        }
      });

      throw error;
    }
  }

  /**
   * Receive inbound message (from webhook)
   */
  async receiveMessage(params: ReceiveMessageParams) {
    const { phoneNumber, text, contactName, timestamp } = params;

    // Get or create conversation
    const conversation = await conversationService.getOrCreateConversation(
      phoneNumber,
      contactName
    );

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        text,
        messageType: 'text',
        status: 'received',
        timestamp: timestamp || new Date()
      }
    });

    // Update conversation
    await conversationService.updateLastMessage(conversation.id, text);
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
  async updateMessageStatus(messageId: string, status: string) {
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
}

export const messageService = new MessageService();
