import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAgentSchema, updateAgentSchema, changePasswordSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.put('/profile', agentController.updateProfile);
router.post('/change-password', validate(changePasswordSchema), agentController.changePassword);
router.get('/all', agentController.getAllAgents);
router.post('/', requireSuperAdmin, validate(createAgentSchema), agentController.createAgent);
router.put('/:agentId', requireSuperAdmin, validate(updateAgentSchema), agentController.updateAgent);
router.put('/:agentId/role', requireSuperAdmin, agentController.updateAgentRole);
router.delete('/:agentId', requireSuperAdmin, agentController.deleteAgent);

export default router;
