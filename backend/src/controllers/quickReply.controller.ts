import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const quickReplyController = {
  // Get all quick replies. Pass ?active=true to only get the ones shown in the chat picker.
  async getQuickReplies(req: Request, res: Response) {
    try {
      const { active } = req.query as { active?: string };
      const quickReplies = await prisma.quickReply.findMany({
        where: active === 'true' ? { isActive: true } : undefined,
        orderBy: { createdAt: 'asc' },
      });
      res.json({ quickReplies });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch quick replies' });
    }
  },

  async createQuickReply(req: Request, res: Response) {
    try {
      const { title, text, isActive } = req.body;

      if (!title || !text) {
        return res.status(400).json({ error: 'Title and text are required' });
      }

      const quickReply = await prisma.quickReply.create({
        data: { title, text, isActive: isActive ?? true },
      });

      res.status(201).json({ quickReply });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to create quick reply' });
    }
  },

  async updateQuickReply(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, text, isActive } = req.body;

      const quickReply = await prisma.quickReply.update({
        where: { id },
        data: { title, text, isActive },
      });

      res.json({ quickReply });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Quick reply not found' });
      }
      res.status(500).json({ error: 'Failed to update quick reply' });
    }
  },

  async deleteQuickReply(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.quickReply.delete({ where: { id } });

      res.json({ message: 'Quick reply deleted successfully' });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Quick reply not found' });
      }
      res.status(500).json({ error: 'Failed to delete quick reply' });
    }
  },
};
