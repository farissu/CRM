import express from 'express';
import { labelController } from '../controllers/label.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { validate } from '../middleware/validate.middleware';
import { createLabelSchema, updateLabelSchema, assignLabelSchema, assignLabelByPhoneSchema } from '../schemas';

const router = express.Router();

// External integrations (n8n, scripts, etc.) — API key auth, keyed by WhatsApp phone number
// since callers only have the phone number from the WhatsApp webhook, not the internal contactId.
router.post('/assign-by-phone', apiKeyAuth, validate(assignLabelByPhoneSchema), labelController.assignLabelToContactByPhone);
router.post('/remove-by-phone', apiKeyAuth, validate(assignLabelByPhoneSchema), labelController.removeLabelFromContactByPhone);
router.get('/by-phone/:phoneNumber', apiKeyAuth, labelController.getContactLabelsByPhone);

router.use(authenticate);

router.get('/', labelController.getLabels);
router.post('/', validate(createLabelSchema), labelController.createLabel);
router.put('/:id', validate(updateLabelSchema), labelController.updateLabel);
router.delete('/:id', labelController.deleteLabel);

router.post('/assign', validate(assignLabelSchema), labelController.assignLabelToContact);
router.post('/remove', validate(assignLabelSchema), labelController.removeLabelFromContact);
router.get('/contact/:contactId', labelController.getContactLabels);

export default router;
