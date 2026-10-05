import axios from 'axios';
import { dedupeCaseInsensitive } from '../utils/error-format.util';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

interface SendMessageParams {
  to: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
}

interface MetaMessageResponse {
  recipient_id: string;
  message_id: string;
}

interface MetaApiError {
  message?: string;
  code?: number;
  error_data?: { details?: string };
}

function formatMetaApiError(status: number, metaError: MetaApiError | undefined, fallback: string): string {
  const uniqueParts = dedupeCaseInsensitive([metaError?.message ?? fallback, metaError?.error_data?.details]);
  return `Meta API error ${status} (code: ${metaError?.code ?? 'unknown'}): ${uniqueParts.join(' — ')}`;
}

function resolveAttachmentType(mediaType?: string): 'image' | 'video' | 'audio' | 'file' {
  if (mediaType?.startsWith('image/')) return 'image';
  if (mediaType?.startsWith('video/')) return 'video';
  if (mediaType?.startsWith('audio/')) return 'audio';
  return 'file';
}

// Instagram Messaging API (Messenger Platform / Facebook Login flow): no message templates,
// no interactive buttons like WhatsApp's — replies are only accepted within 24h of the
// customer's last message (enforced by Meta, not by this service).
export class InstagramService {
  // Sends go through the Facebook Page linked to the Instagram account, authenticated with
  // that Page's access token. POSTing to /{ig-business-account-id}/messages is rejected by
  // Meta with "(#3) Application does not have the capability to make this API call".
  private get pageId(): string {
    return process.env.INSTAGRAM_PAGE_ID || '';
  }

  private get accessToken(): string {
    return process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '';
  }

  async sendMessage(params: SendMessageParams): Promise<string> {
    const { to, text, mediaUrl, mediaType } = params;

    if (!this.pageId || !this.accessToken) {
      throw new Error('Instagram credentials not configured. Set INSTAGRAM_PAGE_ID and INSTAGRAM_PAGE_ACCESS_TOKEN.');
    }

    const message = mediaUrl
      ? { attachment: { type: resolveAttachmentType(mediaType), payload: { url: mediaUrl, is_reusable: true } } }
      : { text: text ?? '' };

    const payload = {
      recipient: { id: to },
      message,
    };

    try {
      const response = await axios.post<MetaMessageResponse>(
        `${GRAPH_API_URL}/${this.pageId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );

      if (!response.data.message_id) {
        throw new Error('No message ID returned from Instagram API');
      }

      return response.data.message_id;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const metaError = err.response.data?.error;
        throw new Error(formatMetaApiError(err.response.status, metaError, err.message));
      }
      throw err;
    }
  }
}

export const instagramService = new InstagramService();
