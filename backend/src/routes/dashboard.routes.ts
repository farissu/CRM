import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, requireNonAgent } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { dashboardStatsQuerySchema } from '../schemas';

const router = Router();

// All routes require authentication, and are ADMIN+ only — AGENT has no dashboard access
router.use(authenticate, requireNonAgent);

// Aggregated business stats for the dashboard
router.get('/stats', validate(dashboardStatsQuerySchema, 'query'), (req, res) => dashboardController.getStats(req, res));

// Per-agent performance/workload stats for the Agent Dashboard
router.get('/agents', (req, res) => dashboardController.getAgentStats(req, res));

export default router;
