import { ConversationStatus, MessageType } from '@prisma/client';
import prisma from '../config/database';
import { io } from '../index';
import { isClosingMessage } from '../utils/closing-message.util';

/**
 * Auto-resolves a conversation when the customer's latest message only closes it — a
 * sticker, or text containing Aamiin/Alhamdulillah — so it doesn't sit in "Belum
 * Dibalas" waiting for a reply nobody needs to send. The conversation is assigned to the
 * PIC agent in AUTO_RESOLVE_AGENT_ID; leaving that unset turns the feature off, so it's
 * opt-in per client deployment.
 *
 * Safe to resolve: the next customer message opens a fresh OPEN conversation
 * (getOrCreateConversation only reuses OPEN ones), so nothing new gets hidden.
 */
class AutoResolveService {
  async maybeAutoResolve(conversationId: string, inboundText: string, inboundType: MessageType): Promise<void> {
    const picAgentId = process.env.AUTO_RESOLVE_AGENT_ID?.trim();
    if (!picAgentId) return;
    if (!isClosingMessage(inboundText, inboundType)) return;

    try {
      const picAgent = await prisma.agent.findFirst({ where: { id: picAgentId, isActive: true }, select: { id: true } });
      if (!picAgent) {
        console.error(`[AutoResolve] AUTO_RESOLVE_AGENT_ID ${picAgentId} is not an active agent; skipping`);
        return;
      }

      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConversationStatus.RESOLVED, assignedAgentId: picAgent.id, unreadCount: 0 },
        include: {
          contact: true,
          assignedAgent: { select: { id: true, name: true, email: true } },
        },
      });

      io.emit('conversation_updated', conversation);
    } catch (err: unknown) {
      // Never let this break the inbound-message flow; the conversation just stays open.
      console.error(`[AutoResolve] Failed to auto-resolve conversation ${conversationId}:`, err);
    }
  }
}

export const autoResolveService = new AutoResolveService();
