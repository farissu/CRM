import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { agentPerformanceService, DashboardPeriod } from '../services/agentPerformance.service';

const VALID_PERIODS: DashboardPeriod[] = ['today', 'week', 'month', 'custom'];

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
      const { period, startDate, endDate } = req.query;
      const resolvedPeriod = VALID_PERIODS.includes(period as DashboardPeriod) ? (period as DashboardPeriod) : 'today';
      const stats = await agentPerformanceService.getStats(
        req.user!.role,
        req.user!.companyId,
        resolvedPeriod,
        typeof startDate === 'string' ? startDate : undefined,
        typeof endDate === 'string' ? endDate : undefined
      );
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
