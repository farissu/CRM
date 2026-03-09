import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all conversations
router.get('/', (req, res) => conversationController.getConversations(req, res));

// Get conversation by ID
router.get('/:id', (req, res) => conversationController.getConversationById(req, res));

// Assign agent to conversation
router.patch('/:id/assign', (req, res) => conversationController.assignAgent(req, res));

// Resolve conversation
router.patch('/:id/resolve', (req, res) => conversationController.resolveConversation(req, res));

// Mark conversation as read
router.patch('/:id/read', (req, res) => conversationController.markAsRead(req, res));

export default router;
