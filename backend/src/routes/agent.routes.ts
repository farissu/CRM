import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile management (authenticated users)
router.put('/profile', agentController.updateProfile);
router.post('/change-password', agentController.changePassword);

// Agent management
router.get('/all', agentController.getAllAgents); // All authenticated users can see agents in their company
router.post('/', requireSuperAdmin, agentController.createAgent);
router.put('/:agentId', requireSuperAdmin, agentController.updateAgent);
router.put('/:agentId/role', requireSuperAdmin, agentController.updateAgentRole);
router.delete('/:agentId', requireSuperAdmin, agentController.deleteAgent);

export default router;
