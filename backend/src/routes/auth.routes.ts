import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../schemas';

const router = Router();

router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));
router.get('/me', (req, res) => authController.me(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/whatsapp/token', (req, res) => authController.saveWhatsAppToken(req, res));

export default router;
