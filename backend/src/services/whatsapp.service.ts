import axios from 'axios';
import FormData from 'form-data';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

const SUPPORTED_MEDIA_MIME_TYPES = new Set<string>([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/3gpp',
  'application/pdf',
]);

const FORMAT_FALLBACK_MIME_TYPE: Record<'IMAGE' | 'VIDEO' | 'DOCUMENT', string> = {
  IMAGE: 'image/jpeg',
  VIDEO: 'video/mp4',
  DOCUMENT: 'application/pdf',
};

const MIME_TYPE_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
};

interface QuickReplyButton {
  id: string;
  title: string;
}

interface SendMessageParams {
  to: string;
  text?: string;
  messageType?: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttons?: QuickReplyButton[];
  quotedExternalId?: string;
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
  carouselCards?: Array<{ format: 'IMAGE' | 'VIDEO'; id: string }>;
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
    const { to, text, messageType = 'text', mediaUrl, caption, fileName, buttonText, buttonUrl, buttons, quotedExternalId } = params;

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const payload = this.buildPayload(to, messageType, text, mediaUrl, caption, fileName, buttonText, buttonUrl, buttons, quotedExternalId);

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
   *
   * `expectedFormat` is used to pick a safe content-type fallback — Meta's CDN doesn't
   * reliably return a WhatsApp-supported content-type header for every media kind (video
   * in particular), and uploading with an unsupported/generic content-type gets rejected.
   */
  async uploadMediaFromUrl(url: string, expectedFormat?: 'IMAGE' | 'VIDEO' | 'DOCUMENT'): Promise<string> {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    let download: { data: ArrayBuffer; headers: Record<string, unknown> };
    try {
      download = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    } catch (err: unknown) {
      throw new Error(`Failed to download media from ${url}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Meta's CDN does not reliably report the correct content-type for template header
    // example media — confirmed: a VIDEO header's example link came back labeled
    // "image/jpeg" while serving the actual video bytes (same byte length as the
    // originally uploaded video). When we already know the true format from the
    // template's own component data, trust that over whatever the CDN claims.
    const downloadedMimeType = (download.headers['content-type'] as string | undefined)?.split(';')[0].trim();
    const mimeType =
      (expectedFormat && FORMAT_FALLBACK_MIME_TYPE[expectedFormat]) ||
      (downloadedMimeType && SUPPORTED_MEDIA_MIME_TYPES.has(downloadedMimeType) ? downloadedMimeType : undefined) ||
      downloadedMimeType ||
      'application/octet-stream';
    const filename = `media${MIME_TYPE_EXTENSION[mimeType] ?? ''}`;

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    // WhatsApp's Media Upload API requires `type` as its own form field, not just the
    // file part's Content-Type header — omitting it fails with a generic (#100) error.
    form.append('type', mimeType);
    form.append('file', Buffer.from(download.data), { filename, contentType: mimeType });

    try {
      const response = await axios.post<MetaMediaUploadResponse>(
        `${GRAPH_API_URL}/${this.phoneNumberId}/media`,
        form,
        { headers: { Authorization: `Bearer ${this.accessToken}`, ...form.getHeaders() } }
      );

      return response.data.id;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const metaError = err.response.data?.error;
        console.error('[WhatsAppService] Media upload rejected by Meta:', {
          url,
          downloadedContentType: download.headers['content-type'],
          downloadedByteLength: Buffer.from(download.data).byteLength,
          resolvedMimeType: mimeType,
          metaResponse: err.response.data,
        });
        throw new Error(
          `Meta API error ${err.response.status}: ${metaError?.message ?? err.message} (code: ${metaError?.code ?? 'unknown'})`
        );
      }
      throw err;
    }
  }

  async sendReaction(to: string, messageId: string, emoji: string): Promise<string> {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    };

    try {
      const response = await axios.post<MetaMessageResponse>(
        `${GRAPH_API_URL}/${this.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );

      return response.data.messages?.[0]?.id ?? '';
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

  async sendTemplateMessage(params: SendTemplateMessageParams): Promise<string> {
    const { to, templateName, language, bodyParams = [], headerMedia, carouselCards } = params;

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
    if (carouselCards && carouselCards.length > 0) {
      components.push({
        type: 'carousel',
        cards: carouselCards.map((card, cardIndex) => {
          const mediaKey = card.format.toLowerCase();
          return {
            card_index: cardIndex,
            components: [{ type: 'header', parameters: [{ type: mediaKey, [mediaKey]: { id: card.id } }] }],
          };
        }),
      });
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
    buttonUrl?: string,
    buttons?: QuickReplyButton[],
    quotedExternalId?: string
  ): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      ...(quotedExternalId && { context: { message_id: quotedExternalId } })
    };

    if (messageType === 'interactive_buttons' && buttons?.length) {
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          ...(mediaUrl && { header: { type: 'image', image: { link: mediaUrl } } }),
          body: { text: text || caption || '' },
          action: {
            buttons: buttons.map((button) => ({
              type: 'reply',
              reply: { id: button.id, title: button.title },
            })),
          },
        },
      };
    }

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
