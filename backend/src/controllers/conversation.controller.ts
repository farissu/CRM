import { Request, Response } from 'express';
import { conversationService } from '../services/conversation.service';

export class ConversationController {
  /**
   * GET /api/conversations
   */
  async getConversations(req: Request, res: Response) {
    try {
      const { agentId, status, page = '1', limit = '20', search, includeCounts, unreadOnly, awaitingReply, labelId } = req.query;

      const result = await conversationService.getConversations({
        agentId: agentId as string,
        status: status as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        includeCounts: includeCounts === 'true',
        unreadOnly: unreadOnly === 'true',
        awaitingReply: awaitingReply === 'true',
        labelId: labelId as string
      });

      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to fetch conversations',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/conversations/:id
   */
  async getConversationById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.getConversationById(id);

      res.json(conversation);
    } catch (err: unknown) {
      res.status(404).json({
        error: 'Conversation not found',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * PATCH /api/conversations/:id/assign
   */
  async assignAgent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const conversation = await conversationService.assignAgent(id, agentId);

      res.json(conversation);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to assign agent',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * PATCH /api/conversations/:id/resolve
   */
  async resolveConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.resolveConversation(id);

      res.json(conversation);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to resolve conversation',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * PATCH /api/conversations/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.markAsRead(id);

      res.json(conversation);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to mark as read',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
}

export const conversationController = new ConversationController();
