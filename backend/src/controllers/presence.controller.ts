import { Request, Response } from 'express';
import prisma from '../config/database';
import { presenceService } from '../services/presence.service';

const VALID_STATUSES = ['ACTIVE', 'OFFLINE'] as const;

// Manual status toggle for the logged-in agent (e.g. "go offline" while still connected)
export const updateMyStatus = async (req: Request, res: Response) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or OFFLINE' });
    }

    const agent = await presenceService.setStatus(agentId, status, 'MANUAL');
    return res.json({ agent });
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

// Paginated status-change history for one agent, for activity/work-history review
export const getStatusHistory = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });

    const canViewAnyAgent = requester.role === 'SUPER_ADMIN' || requester.role === 'ADMIN';
    if (!canViewAnyAgent && requester.id !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetAgent = await prisma.agent.findUnique({ where: { id: agentId }, select: { companyId: true } });
    if (!targetAgent) return res.status(404).json({ error: 'Agent not found' });
    if (requester.role === 'ADMIN' && targetAgent.companyId !== requester.companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

    const history = await presenceService.getHistory(agentId, page, limit);
    return res.json(history);
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to get status history' });
  }
};
