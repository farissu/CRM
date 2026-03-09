import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// Login
router.post('/login', (req, res) => authController.login(req, res));

// Get current user
router.get('/me', (req, res) => authController.me(req, res));

// Logout
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;
