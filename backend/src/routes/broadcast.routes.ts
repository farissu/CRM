import { Router } from 'express';
import multer from 'multer';
import { broadcastController } from '../controllers/broadcast.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_SIZE_BYTES },
});

router.use(authenticate);

router.get('/', broadcastController.getBroadcasts);
router.get('/csv-template/:templateId', broadcastController.downloadCsvTemplate);
router.get('/:id', broadcastController.getBroadcastById);
router.post('/', upload.single('csvFile'), broadcastController.createBroadcast);
router.post('/test', broadcastController.sendTest);
router.delete('/:id', broadcastController.cancelBroadcast);

export default router;
