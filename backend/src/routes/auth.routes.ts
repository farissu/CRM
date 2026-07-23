import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../schemas';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));
router.get('/me', authenticate, (req, res) => authController.me(req, res));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

export default router;
