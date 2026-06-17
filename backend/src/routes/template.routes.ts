import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', templateController.getTemplates);
router.post('/', templateController.createTemplate);
router.post('/sync', templateController.syncTemplates);
router.delete('/:id', templateController.deleteTemplate);

export default router;
