import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Wappin webhook endpoint (NO authentication required - external webhook)
router.post('/webhooks/wappin', (req, res) => messageController.handleWebhook(req, res));

// All other routes require authentication
router.use(authenticate);

// Send message
router.post('/', (req, res) => messageController.sendMessage(req, res));

export default router;
