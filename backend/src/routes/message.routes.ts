import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Send message
router.post('/', (req, res) => messageController.sendMessage(req, res));

// Wappin webhook endpoint
router.post('/webhooks/wappin', (req, res) => messageController.handleWebhook(req, res));

export default router;
