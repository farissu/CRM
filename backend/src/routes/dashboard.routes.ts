import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Aggregated business stats for the dashboard
router.get('/stats', (req, res) => dashboardController.getStats(req, res));

export default router;
