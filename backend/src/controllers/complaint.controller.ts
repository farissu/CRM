import { Request, Response } from 'express';
import { complaintService, CsatLinkTypeNotConfiguredError } from '../services/complaint.service';

export class ComplaintController {
  async create(req: Request, res: Response) {
    try {
      const { conversationId, type } = req.body as { conversationId: string; type: string };
      const agentId = req.user!.id;
      const result = await complaintService.createForConversation(conversationId, agentId, type);
      res.status(201).json(result);
    } catch (err: unknown) {
      if (err instanceof CsatLinkTypeNotConfiguredError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to send CSAT link', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async createExternal(req: Request, res: Response) {
    try {
      const { phoneNumber, name, type } = req.body as { phoneNumber: string; name?: string; type: string };
      const result = await complaintService.createForPhone({ phoneNumber, name, type });
      res.status(201).json(result);
    } catch (err: unknown) {
      if (err instanceof CsatLinkTypeNotConfiguredError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to send CSAT link', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
}

export const complaintController = new ComplaintController();
