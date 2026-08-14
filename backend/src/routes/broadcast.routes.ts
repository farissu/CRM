import { Router } from 'express';
import multer from 'multer';
import { broadcastController } from '../controllers/broadcast.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const MAX_EXCEL_SIZE_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EXCEL_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    // Browsers/OSes report inconsistent mimetypes for .xlsx (it's a zip container),
    // so the extension is the only reliable signal here; parseBroadcastExcel still
    // validates the actual file contents downstream.
    if (file.originalname.toLowerCase().endsWith('.xlsx')) {
      cb(null, true);
      return;
    }
    const error = new Error('Only .xlsx Excel files are supported') as Error & { status?: number };
    error.status = 400;
    cb(error);
  },
});

router.use(authenticate);

router.get('/', broadcastController.getBroadcasts);
router.get('/excel-template/:templateId', broadcastController.downloadExcelTemplate);
router.get('/:id', broadcastController.getBroadcastById);
router.post('/', upload.single('excelFile'), broadcastController.createBroadcast);
router.post('/test', broadcastController.sendTest);
router.delete('/:id', broadcastController.cancelBroadcast);

export default router;
