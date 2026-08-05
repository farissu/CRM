import { Router } from 'express';
import multer from 'multer';
import { templateController } from '../controllers/template.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const MAX_HEADER_MEDIA_SIZE_BYTES = 16 * 1024 * 1024; // WhatsApp's template header media limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HEADER_MEDIA_SIZE_BYTES },
});

router.use(authenticate);

router.get('/', templateController.getTemplates);
router.post('/', templateController.createTemplate);
router.post('/sync', templateController.syncTemplates);
router.post('/upload-media', upload.single('file'), templateController.uploadHeaderMedia);
router.delete('/:id', templateController.deleteTemplate);

export default router;
