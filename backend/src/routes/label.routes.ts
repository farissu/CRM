import express from 'express';
import { labelController } from '../controllers/label.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createLabelSchema, updateLabelSchema, assignLabelSchema } from '../schemas';

const router = express.Router();

router.use(authenticate);

router.get('/', labelController.getLabels);
router.post('/', validate(createLabelSchema), labelController.createLabel);
router.put('/:id', validate(updateLabelSchema), labelController.updateLabel);
router.delete('/:id', labelController.deleteLabel);

router.post('/assign', validate(assignLabelSchema), labelController.assignLabelToContact);
router.post('/remove', validate(assignLabelSchema), labelController.removeLabelFromContact);
router.get('/contact/:contactId', labelController.getContactLabels);

export default router;
