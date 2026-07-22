import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { verifyMetaSignature } from '../middleware/verifyMetaSignature';
import { sendMessageSchema } from '../schemas';

const router = Router();

// WhatsApp Cloud API webhook endpoints (no JWT — called by Meta; POST body integrity
// is instead verified via the X-Hub-Signature-256 HMAC in verifyMetaSignature)
router.get('/webhooks/whatsapp', (req, res) => messageController.verifyWebhook(req, res));
router.post('/webhooks/whatsapp', verifyMetaSignature, (req, res) => messageController.handleWebhook(req, res));

// Media proxy — handles its own auth (accepts ?token= query param for <img src> compatibility)
router.get('/media/:mediaId', (req, res) => messageController.getMedia(req, res));

// All other routes require authentication
router.use(authenticate);

// Send message
router.post('/', validate(sendMessageSchema), (req, res) => messageController.sendMessage(req, res));

export default router;
