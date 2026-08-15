import { Prisma, ConversationStatus, MessageDirection } from '@prisma/client';
import prisma from '../config/database';
import { io } from '../index';

export interface GetConversationsOptions {
  agentId?: string;
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  includeCounts?: boolean;
  unreadOnly?: boolean;
  awaitingReply?: boolean;
  /** A label id, or the sentinel 'UNLABELED' for contacts with no labels at all. */
  labelId?: string;
}

export class ConversationService {
  /**
   * Get all conversations with pagination and filters
   */
  async getConversations(options: GetConversationsOptions = {}) {
    const {
      agentId,
      status,
      page = 1,
      limit = 20,
      search,
      includeCounts = false,
      unreadOnly = false,
      awaitingReply = false,
      labelId
    } = options;
    const skip = (page - 1) * limit;

    // Tab badge counts must reflect the true total per status, not just whatever page
    // of rows happens to be loaded — so they're computed against agentId only, never
    // against the status/unread/label/search filters used for the current page's row
    // query below.
    const baseWhere: Prisma.ConversationWhereInput = agentId ? { assignedAgentId: agentId } : {};

    const searchTerm = search?.trim();
    const contactFilter: Prisma.ContactWhereInput | undefined =
      searchTerm || labelId
        ? {
            ...(searchTerm
              ? {
                  OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' as const } },
                    { phoneNumber: { contains: searchTerm } }
                  ]
                }
              : {}),
            ...(labelId === 'UNLABELED' ? { labels: { none: {} } } : labelId ? { labels: { some: { labelId } } } : {})
          }
        : undefined;

    const where: Prisma.ConversationWhereInput = {
      ...baseWhere,
      ...(status ? { status: status as ConversationStatus } : {}),
      ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      ...(awaitingReply ? { lastMessageDirection: MessageDirection.INBOUND } : {}),
      ...(contactFilter ? { contact: contactFilter } : {})
    };

    // The status/label badge counts only matter to the sidebar's first page load — every
    // "load more" scroll and search keystroke was otherwise re-running labels.length + 6
    // extra COUNT queries for numbers nothing on screen would even re-render. `labels`
    // runs alongside this batch (not before it) so its own latency is hidden behind the
    // larger queries here; the per-label counts below still need the resolved label ids
    // first, so they unavoidably add one more round trip on top of this batch.
    const [labels, conversations, total, allCount, servedCount, unreadCount, awaitingReplyCount, unlabeledOpenCount] = await Promise.all([
      includeCounts ? prisma.label.findMany({ select: { id: true, name: true, color: true } }) : Promise.resolve([]),
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
      prisma.conversation.count({ where }),
      includeCounts ? prisma.conversation.count({ where: baseWhere }) : Promise.resolve(0),
      includeCounts
        ? prisma.conversation.count({ where: { ...baseWhere, status: ConversationStatus.OPEN } })
        : Promise.resolve(0),
      includeCounts
        ? prisma.conversation.count({ where: { ...baseWhere, status: ConversationStatus.OPEN, unreadCount: { gt: 0 } } })
        : Promise.resolve(0),
      includeCounts
        ? prisma.conversation.count({
            where: { ...baseWhere, status: ConversationStatus.OPEN, lastMessageDirection: MessageDirection.INBOUND }
          })
        : Promise.resolve(0),
      includeCounts
        ? prisma.conversation.count({
            where: { ...baseWhere, status: ConversationStatus.OPEN, contact: { labels: { none: {} } } }
          })
        : Promise.resolve(0)
    ]);

    const perLabelOpenCounts = includeCounts
      ? await Promise.all(
          labels.map(label =>
            prisma.conversation.count({
              where: { ...baseWhere, status: ConversationStatus.OPEN, contact: { labels: { some: { labelId: label.id } } } }
            })
          )
        )
      : [];

    // Transform conversations to flatten labels
    const transformedConversations = conversations.map(conv => ({
      ...conv,
      contact: {
        ...conv.contact,
        labels: conv.contact.labels.map(cl => cl.label)
      }
    }));

    const result: {
      conversations: typeof transformedConversations;
      total: number;
      page: number;
      totalPages: number;
      statusCounts?: { served: number; unread: number; awaitingReply: number; all: number };
      labelCounts?: { unlabeled: number; byLabel: Record<string, number> };
    } = {
      conversations: transformedConversations,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };

    if (includeCounts) {
      result.statusCounts = { served: servedCount, unread: unreadCount, awaitingReply: awaitingReplyCount, all: allCount };
      result.labelCounts = {
        unlabeled: unlabeledOpenCount,
        byLabel: Object.fromEntries(labels.map((label, i) => [label.id, perLabelOpenCounts[i]]))
      };
    }

    return result;
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
        status: ConversationStatus.OPEN,
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
          status: ConversationStatus.OPEN,
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
        status: ConversationStatus.RESOLVED
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
  async updateLastMessage(conversationId: string, text: string, direction: MessageDirection) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: text,
        lastMessageAt: new Date(),
        lastMessageDirection: direction
      }
    });
  }
}

export const conversationService = new ConversationService();
