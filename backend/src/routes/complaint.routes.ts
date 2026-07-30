import { Router } from 'express';
import { complaintController } from '../controllers/complaint.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { validate } from '../middleware/validate.middleware';
import { createComplaintSchema, createComplaintExternalSchema } from '../schemas';

const router = Router();

// External integrations (n8n, scripts) — API key auth, not JWT.
router.post('/external', apiKeyAuth, validate(createComplaintExternalSchema), (req, res) => complaintController.createExternal(req, res));

// Dashboard agent — JWT auth
router.use(authenticate);
router.post('/', validate(createComplaintSchema), (req, res) => complaintController.create(req, res));

export default router;
