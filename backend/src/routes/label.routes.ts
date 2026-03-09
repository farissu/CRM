import express from 'express';
import { labelController } from '../controllers/label.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Label CRUD
router.get('/', labelController.getLabels);
router.post('/', labelController.createLabel);
router.put('/:id', labelController.updateLabel);
router.delete('/:id', labelController.deleteLabel);

// Assign/remove labels to contacts
router.post('/assign', labelController.assignLabelToContact);
router.post('/remove', labelController.removeLabelFromContact);

// Get contact labels
router.get('/contact/:contactId', labelController.getContactLabels);

export default router;
