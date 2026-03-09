import { Request, Response } from 'express';
import { messageService } from '../services/message.service';

export class MessageController {
  /**
   * GET /api/conversations/:id/messages
   */
  async getMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { page = '1', limit = '50' } = req.query;

      const result = await messageService.getMessages(
        id,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json(result);
    } catch (error: any) {
      console.error('Get messages error:', error);
      res.status(500).json({
        error: 'Failed to fetch messages',
        message: error.message
      });
    }
  }

  /**
   * POST /api/messages
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { conversationId, text, senderId } = req.body;

      if (!conversationId || !text || !senderId) {
        return res.status(400).json({
          error: 'conversationId, text, and senderId are required'
        });
      }

      const message = await messageService.sendMessage({
        conversationId,
        text,
        senderId
      });

      res.status(201).json(message);
    } catch (error: any) {
      console.error('Send message error:', error);
      res.status(500).json({
        error: 'Failed to send message',
        message: error.message
      });
    }
  }

  /**
   * POST /api/webhooks/wappin
   * Receive inbound messages from Wappin (WhatsApp Business API format)
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const webhookData = req.body;
      
      console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

      // WhatsApp Business API format
      // Structure: body.entry[].changes[].value.messages[]
      if (webhookData.entry && Array.isArray(webhookData.entry)) {
        for (const entry of webhookData.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              const value = change.value;
              
              // Process messages
              if (value.messages && Array.isArray(value.messages)) {
                for (const message of value.messages) {
                  // Extract message data
                  const from = message.from; // Phone number
                  const messageId = message.id;
                  const timestamp = message.timestamp ? parseInt(message.timestamp) * 1000 : Date.now();
                  
                  // Get text content
                  let text = '';
                  if (message.type === 'text' && message.text) {
                    text = message.text.body;
                  } else if (message.type === 'button' && message.button) {
                    text = message.button.text;
                  } else if (message.type === 'interactive' && message.interactive) {
                    text = message.interactive.button_reply?.title || 
                           message.interactive.list_reply?.title || '';
                  }
                  
                  // Get contact name
                  let contactName = from;
                  if (value.contacts && Array.isArray(value.contacts)) {
                    const contact = value.contacts.find((c: any) => c.wa_id === from);
                    if (contact && contact.profile && contact.profile.name) {
                      contactName = contact.profile.name;
                    }
                  }
                  
                  // Process message if we have required data
                  if (from && text) {
                    await messageService.receiveMessage({
                      phoneNumber: from,
                      text,
                      contactName,
                      timestamp: new Date(timestamp)
                    });
                  }
                }
              }
            }
          }
        }
      }
      // Fallback: Simple format (for backward compatibility)
      else if (webhookData.from && webhookData.text) {
        await messageService.receiveMessage({
          phoneNumber: webhookData.from,
          text: webhookData.text,
          contactName: webhookData.name,
          timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : undefined
        });
      }
      // Alternative format: body.body (based on user's structure)
      else if (webhookData.body) {
        const body = webhookData.body;
        
        // Check for messages in body
        if (body.messages && Array.isArray(body.messages)) {
          for (const message of body.messages) {
            const from = message.from;
            let text = '';
            
            if (message.type === 'text' && message.text) {
              text = message.text.body;
            }
            
            // Get contact name from contacts array
            let contactName = from;
            if (body.contacts && Array.isArray(body.contacts)) {
              const contact = body.contacts.find((c: any) => c.wa_id === from);
              if (contact && contact.profile && contact.profile.name) {
                contactName = contact.profile.name;
              }
            }
            
            if (from && text) {
              await messageService.receiveMessage({
                phoneNumber: from,
                text,
                contactName,
                timestamp: message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : undefined
              });
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  }
}

export const messageController = new MessageController();
