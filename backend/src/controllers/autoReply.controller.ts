import { Request, Response } from 'express';
import { autoReplyService } from '../services/autoReply.service';

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await autoReplyService.getSettings();
    return res.json({ settings });
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to get auto-reply settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { isEnabled, message, workingDays, startTime, endTime } = req.body;
    const settings = await autoReplyService.updateSettings({ isEnabled, message, workingDays, startTime, endTime });
    return res.json({ settings });
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to update auto-reply settings' });
  }
};
