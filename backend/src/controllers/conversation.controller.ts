import { Request, Response } from 'express';
import { conversationService } from '../services/conversation.service';

export class ConversationController {
  /**
   * GET /api/conversations
   */
  async getConversations(req: Request, res: Response) {
    try {
      const { agentId, status, page = '1', limit = '20' } = req.query;

      const result = await conversationService.getConversations(
        agentId as string,
        status as string,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json(result);
    } catch (error: any) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        error: 'Failed to fetch conversations',
        message: error.message
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
    } catch (error: any) {
      console.error('Get conversation error:', error);
      res.status(404).json({
        error: 'Conversation not found',
        message: error.message
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
    } catch (error: any) {
      console.error('Assign agent error:', error);
      res.status(500).json({
        error: 'Failed to assign agent',
        message: error.message
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
    } catch (error: any) {
      console.error('Resolve conversation error:', error);
      res.status(500).json({
        error: 'Failed to resolve conversation',
        message: error.message
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
    } catch (error: any) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        error: 'Failed to mark as read',
        message: error.message
      });
    }
  }
}

export const conversationController = new ConversationController();
