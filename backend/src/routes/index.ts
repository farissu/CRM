import { Router } from 'express';
import authRoutes from './auth.routes';
import conversationRoutes from './conversation.routes';
import messageRoutes from './message.routes';
import labelRoutes from './label.routes';
import contactRoutes from './contact.routes';
import agentRoutes from './agent.routes';
import companyRoutes from './company.routes';
import templateRoutes from './template.routes';
import complaintRoutes from './complaint.routes';
import broadcastRoutes from './broadcast.routes';
import quickReplyRoutes from './quickReply.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/labels', labelRoutes);
router.use('/contacts', contactRoutes);
router.use('/agents', agentRoutes);
router.use('/companies', companyRoutes);
router.use('/templates', templateRoutes);
router.use('/complaints', complaintRoutes);
router.use('/broadcasts', broadcastRoutes);
router.use('/quick-replies', quickReplyRoutes);

// Add messages routes under conversations for RESTful structure
router.use('/conversations/:id/messages', (req, res, next) => {
  req.params.id = req.params.id;
  next();
}, (req, res) => {
  const { messageController } = require('../controllers/message.controller');
  messageController.getMessages(req, res);
});

export default router;
