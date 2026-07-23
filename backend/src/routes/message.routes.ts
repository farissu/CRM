import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { validate } from '../middleware/validate.middleware';
import { sendMessageSchema, sendExternalMessageSchema } from '../schemas';

const router = Router();

// WhatsApp Cloud API webhook endpoints (no JWT — called by Meta)
router.get('/webhooks/whatsapp', (req, res) => messageController.verifyWebhook(req, res));
router.post('/webhooks/whatsapp', (req, res) => messageController.handleWebhook(req, res));

// External integrations (n8n, scripts, etc.) — API key auth, not JWT.
// Sent messages are stored and appear in the dashboard like any other outbound message.
router.post('/send-external', apiKeyAuth, validate(sendExternalMessageSchema), (req, res) => messageController.sendExternalMessage(req, res));

// Media proxy — handles its own auth (accepts ?token= query param for <img src> compatibility)
router.get('/media/:mediaId', (req, res) => messageController.getMedia(req, res));

// All other routes require authentication
router.use(authenticate);

// Send message
router.post('/', validate(sendMessageSchema), (req, res) => messageController.sendMessage(req, res));

export default router;
