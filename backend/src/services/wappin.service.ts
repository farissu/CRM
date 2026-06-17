import axios from 'axios';
import { wappinAuthService } from './wappin-auth.service';

interface SendMessageParams {
  to: string;
  text?: string;
  recipientType?: 'individual' | 'group';
  agentId?: string;
  messageType?: string;
  mediaUrl?: string;
  caption?: string;
}

interface WappinMessageResponse {
  messages: Array<{
    id: string;
    status: string;
  }>;
}

export class WappinService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.WAPPIN_API_URL || 'https://api.chat.wappin.app/v1';
  }

  /**
   * Send a text message via Wappin API
   */
  async sendMessage(params: SendMessageParams): Promise<string> {
    try {
      // Get valid token (agent-specific if agentId provided, otherwise global)
      const token = params.agentId 
        ? await wappinAuthService.getTokenForAgent(params.agentId)
        : await wappinAuthService.getToken();

      let payload: any = {
        recipient_type: params.recipientType || 'individual',
        to: params.to
      };

      // Build payload based on message type
      const messageType = params.messageType || 'text';
      
      if (messageType === 'text' || !params.mediaUrl) {
        // Text message
        payload.type = 'text';
        payload.text = {
          body: params.text || params.caption || ''
        };
      } else if (messageType === 'image') {
        // Image message
        payload.type = 'image';
        payload.image = {
          link: params.mediaUrl
        };
        if (params.caption) {
          payload.image.caption = params.caption;
        }
      } else if (messageType === 'video') {
        // Video message
        payload.type = 'video';
        payload.video = {
          link: params.mediaUrl
        };
        if (params.caption) {
          payload.video.caption = params.caption;
        }
      } else if (messageType === 'document') {
        // Document message
        payload.type = 'document';
        payload.document = {
          link: params.mediaUrl
        };
        if (params.caption) {
          payload.document.caption = params.caption;
        }
      } else if (messageType === 'audio') {
        // Audio message
        payload.type = 'audio';
        payload.audio = {
          link: params.mediaUrl
        };
      } else {
        // Default to text
        payload.type = 'text';
        payload.text = {
          body: params.text || params.caption || ''
        };
      }

      const response = await axios.post<WappinMessageResponse>(
        `${this.apiUrl}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.messages || response.data.messages.length === 0) {
        throw new Error('No message data in Wappin response');
      }

      const messageId = response.data.messages[0].id;
      console.log(`Message sent successfully via Wappin, ID: ${messageId}`);

      return messageId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If unauthorized, try to refresh token and retry once
        if (error.response?.status === 401) {
          console.log('Wappin token expired, refreshing...');
          // If agent-specific token, re-login for that agent
          if (params.agentId) {
            await wappinAuthService.loginForAgent(params.agentId);
          } else {
            await wappinAuthService.refreshToken();
          }
          
          // Retry the request with new token
          const newToken = params.agentId
            ? await wappinAuthService.getTokenForAgent(params.agentId)
            : await wappinAuthService.getToken();
          const payload = {
            recipient_type: params.recipientType || 'individual',
            to: params.to,
            type: 'text',
            text: {
              body: params.text
            }
          };

          const retryResponse = await axios.post<WappinMessageResponse>(
            `${this.apiUrl}/messages`,
            payload,
            {
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          return retryResponse.data.messages[0].id;
        }

        console.error('Wappin send message failed:', error.response?.data || error.message);
        throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Handle incoming webhook from Wappin
   */
  async handleWebhook(webhookData: any): Promise<void> {
    try {
      console.log('Received Wappin webhook:', JSON.stringify(webhookData, null, 2));
      // Process webhook data - implement based on Wappin webhook structure
      // This would typically create/update conversations and messages in database
    } catch (error) {
      console.error('Failed to process Wappin webhook:', error);
      throw error;
    }
  }
}

export const wappinService = new WappinService();
