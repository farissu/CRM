import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { agentPerformanceService } from '../services/agentPerformance.service';

export class DashboardController {
  /**
   * GET /api/dashboard/stats
   */
  async getStats(_req: Request, res: Response) {
    try {
      const stats = await dashboardService.getStats();
      res.json(stats);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to fetch dashboard stats',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/dashboard/agents
   */
  async getAgentStats(req: Request, res: Response) {
    try {
      const stats = await agentPerformanceService.getStats(req.user!.role, req.user!.companyId);
      res.json(stats);
    } catch (err: unknown) {
      res.status(500).json({
        error: 'Failed to fetch agent dashboard stats',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
}

export const dashboardController = new DashboardController();
