import axios from 'axios';
import FormData from 'form-data';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

interface SendMessageParams {
  to: string;
  text?: string;
  messageType?: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  buttonText?: string;
  buttonUrl?: string;
}

interface MetaMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
  headerMedia?: { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; id: string };
}

interface MetaMediaUploadResponse {
  id: string;
}

export class WhatsAppService {
  private get phoneNumberId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  private get accessToken(): string {
    return process.env.WHATSAPP_ACCESS_TOKEN || '';
  }

  async sendMessage(params: SendMessageParams): Promise<string> {
    const { to, text, messageType = 'text', mediaUrl, caption, fileName, buttonText, buttonUrl } = params;

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const payload = this.buildPayload(to, messageType, text, mediaUrl, caption, fileName, buttonText, buttonUrl);

    try {
      const response = await axios.post<MetaMessageResponse>(
        `${GRAPH_API_URL}/${this.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );

      if (!response.data.messages?.length) {
        throw new Error('No message ID returned from WhatsApp API');
      }

      return response.data.messages[0].id;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const metaError = err.response.data?.error;
        throw new Error(
          `Meta API error ${err.response.status}: ${metaError?.message ?? err.message} (code: ${metaError?.code ?? 'unknown'})`
        );
      }
      throw err;
    }
  }

  /**
   * Downloads media from a URL and uploads it to WhatsApp's own Media API, returning
   * a media id WhatsApp can attach to outbound messages. Required because WhatsApp's
   * messaging pipeline cannot reliably re-fetch Meta's own signed template-preview CDN
   * URLs (confirmed: those links 403 when WhatsApp itself tries to download them, even
   * though they're fetchable by a normal HTTP client).
   */
  async uploadMediaFromUrl(url: string): Promise<string> {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const download = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const mimeType = (download.headers['content-type'] as string | undefined) ?? 'application/octet-stream';

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', Buffer.from(download.data), { filename: 'media', contentType: mimeType });

    const response = await axios.post<MetaMediaUploadResponse>(
      `${GRAPH_API_URL}/${this.phoneNumberId}/media`,
      form,
      { headers: { Authorization: `Bearer ${this.accessToken}`, ...form.getHeaders() } }
    );

    return response.data.id;
  }

  async sendTemplateMessage(params: SendTemplateMessageParams): Promise<string> {
    const { to, templateName, language, bodyParams = [], headerMedia } = params;

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const components: Array<Record<string, unknown>> = [];
    if (headerMedia) {
      const mediaKey = headerMedia.format.toLowerCase();
      components.push({ type: 'header', parameters: [{ type: mediaKey, [mediaKey]: { id: headerMedia.id } }] });
    }
    if (bodyParams.length > 0) {
      components.push({ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text })) });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length > 0 && { components }),
      },
    };

    try {
      const response = await axios.post<MetaMessageResponse>(
        `${GRAPH_API_URL}/${this.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );

      if (!response.data.messages?.length) {
        throw new Error('No message ID returned from WhatsApp API');
      }

      return response.data.messages[0].id;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const metaError = err.response.data?.error;
        throw new Error(
          `Meta API error ${err.response.status}: ${metaError?.message ?? err.message} (code: ${metaError?.code ?? 'unknown'})`
        );
      }
      throw err;
    }
  }

  private buildPayload(
    to: string,
    messageType: string,
    text?: string,
    mediaUrl?: string,
    caption?: string,
    fileName?: string,
    buttonText?: string,
    buttonUrl?: string
  ): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to
    };

    if (messageType === 'interactive' && buttonUrl) {
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: text || '' },
          action: {
            name: 'cta_url',
            parameters: { display_text: buttonText || 'Buka', url: buttonUrl },
          },
        },
      };
    }

    if (messageType === 'image' && mediaUrl) {
      return { ...base, type: 'image', image: { link: mediaUrl, ...(caption && { caption }) } };
    }

    if (messageType === 'video' && mediaUrl) {
      return { ...base, type: 'video', video: { link: mediaUrl, ...(caption && { caption }) } };
    }

    if (messageType === 'document' && mediaUrl) {
      return {
        ...base,
        type: 'document',
        document: { link: mediaUrl, ...(caption && { caption }), ...(fileName && { filename: fileName }) },
      };
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
