import axios from 'axios';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

interface SendMessageParams {
  to: string;
  text?: string;
  messageType?: string;
  mediaUrl?: string;
  caption?: string;
}

interface MetaMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export class WhatsAppService {
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';

    if (!this.phoneNumberId || !this.accessToken) {
      console.warn('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }
  }

  async sendMessage(params: SendMessageParams): Promise<string> {
    const { to, text, messageType = 'text', mediaUrl, caption } = params;

    const payload = this.buildPayload(to, messageType, text, mediaUrl, caption);

    const response = await axios.post<MetaMessageResponse>(
      `${GRAPH_API_URL}/${this.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.messages?.length) {
      throw new Error('No message ID returned from WhatsApp API');
    }

    return response.data.messages[0].id;
  }

  private buildPayload(
    to: string,
    messageType: string,
    text?: string,
    mediaUrl?: string,
    caption?: string
  ): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to
    };

    if (messageType === 'image' && mediaUrl) {
      return { ...base, type: 'image', image: { link: mediaUrl, ...(caption && { caption }) } };
    }

    if (messageType === 'video' && mediaUrl) {
      return { ...base, type: 'video', video: { link: mediaUrl, ...(caption && { caption }) } };
    }

    if (messageType === 'document' && mediaUrl) {
      return { ...base, type: 'document', document: { link: mediaUrl, ...(caption && { caption }) } };
    }

    if (messageType === 'audio' && mediaUrl) {
      return { ...base, type: 'audio', audio: { link: mediaUrl } };
    }

    return {
      ...base,
      type: 'text',
      text: { preview_url: false, body: text || caption || '' }
    };
  }
}

export const whatsAppService = new WhatsAppService();
