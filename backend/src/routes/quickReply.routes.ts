import express from 'express';
import { quickReplyController } from '../controllers/quickReply.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createQuickReplySchema, updateQuickReplySchema } from '../schemas';

const router = express.Router();

router.use(authenticate);

router.get('/', quickReplyController.getQuickReplies);
router.post('/', validate(createQuickReplySchema), quickReplyController.createQuickReply);
router.put('/:id', validate(updateQuickReplySchema), quickReplyController.updateQuickReply);
router.delete('/:id', quickReplyController.deleteQuickReply);

export default router;
