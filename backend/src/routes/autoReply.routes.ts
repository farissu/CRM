import { Router } from 'express';
import * as autoReplyController from '../controllers/autoReply.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateAutoReplySettingsSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/settings', autoReplyController.getSettings);
router.put('/settings', validate(updateAutoReplySettingsSchema), autoReplyController.updateSettings);

export default router;
