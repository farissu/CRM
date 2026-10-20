import { Request, Response } from 'express';
import { dashboardService, DASHBOARD_RANGE_DAYS, DashboardRangeDays } from '../services/dashboard.service';
import { agentPerformanceService, DashboardPeriod } from '../services/agentPerformance.service';

const VALID_PERIODS: DashboardPeriod[] = ['today', 'week', 'month', 'custom'];
const DEFAULT_RANGE_DAYS: DashboardRangeDays = 7;

export class DashboardController {
  /**
   * GET /api/dashboard/stats?days=7|30
   */
  async getStats(req: Request, res: Response) {
    try {
      const requestedDays = Number(req.query.days);
      const days = DASHBOARD_RANGE_DAYS.find((d) => d === requestedDays) ?? DEFAULT_RANGE_DAYS;
      const stats = await dashboardService.getStats({ role: req.user!.role, companyId: req.user!.companyId }, days);
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
