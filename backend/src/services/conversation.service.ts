import prisma from '../config/database';
import { io } from '../index';

export class ConversationService {
  /**
   * Get all conversations with pagination and filters
   */
  async getConversations(agentId?: string, status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (agentId) {
      where.assignedAgentId = agentId;
    }
    if (status) {
      where.status = status;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              phoneNumber: true,
              name: true,
              email: true,
              labels: {
                include: {
                  label: true
                }
              }
            }
          },
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          messages: {
            take: 1,
            orderBy: {
              timestamp: 'desc'
            }
          }
        },
        orderBy: {
          lastMessageAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.conversation.count({ where })
    ]);

    // Transform conversations to flatten labels
    const transformedConversations = conversations.map(conv => ({
      ...conv,
      contact: {
        ...conv.contact,
        labels: conv.contact.labels.map(cl => cl.label)
      }
    }));

    return {
      conversations: transformedConversations,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            labels: {
              include: {
                label: true
              }
            }
          }
        },
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Transform to flatten labels
    const transformedConversation = {
      ...conversation,
      contact: {
        ...conversation.contact,
        labels: conversation.contact.labels.map(cl => cl.label)
      }
    };

    return transformedConversation;
  }

  /**
   * Get or create conversation for a contact
   */
  async getOrCreateConversation(phoneNumber: string, contactName?: string) {
    // Find or create contact
    let contact = await prisma.contact.findUnique({
      where: { phoneNumber }
    });

    if (!contact) {
      // Create new contact
      contact = await prisma.contact.create({
        data: {
          phoneNumber,
          name: contactName || phoneNumber
        }
      });
    } else if (contactName && contactName !== contact.name) {
      // Update contact name if changed
      contact = await prisma.contact.update({
        where: { phoneNumber },
        data: { name: contactName }
      });
    }

    // Find open conversation for this contact
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        status: 'open'
      },
      include: {
        contact: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create new conversation if none exists
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          status: 'open',
          unreadCount: 0
        },
        include: {
          contact: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    }

    return conversation;
  }

  /**
   * Assign agent to conversation
   */
  async assignAgent(conversationId: string, agentId: string) {
    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: agentId
      },
      include: {
        contact: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Emit socket event
    io.emit('conversation_updated', conversation);

    return conversation;
  }

  /**
   * Resolve conversation
   */
  async resolveConversation(conversationId: string) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'resolved'
      },
      include: {
        contact: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Emit socket event
    io.emit('conversation_updated', conversation);

    return conversation;
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0
      },
      include: {
        contact: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Emit socket event
    io.emit('conversation_updated', conversation);

    return conversation;
  }

  /**
   * Increment unread count
   */
  async incrementUnreadCount(conversationId: string) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: {
          increment: 1
        }
      }
    });
  }

  /**
   * Update last message info
   */
  async updateLastMessage(conversationId: string, text: string) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: text,
        lastMessageAt: new Date()
      }
    });
  }
}

export const conversationService = new ConversationService();
