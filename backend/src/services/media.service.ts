import axios from 'axios';
import { storageService } from './storage.service';

export class MediaService {
  async downloadAndSave(mediaId: string, mimeType?: string): Promise<string> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN not configured');

    const metaRes = await axios.get<{ url: string; mime_type: string }>(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const { url, mime_type } = metaRes.data;
    const resolvedMime = mimeType || mime_type;

    const fileRes = await axios.get<ArrayBuffer>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    return storageService.uploadBuffer(Buffer.from(fileRes.data), resolvedMime);
  }

  /**
   * Downloads media from an arbitrary external URL (e.g. a payment gateway's
   * QR code image) and archives it in our own storage, instead of only
   * relying on the source staying reachable.
   */
  async downloadFromUrlAndSave(url: string, mimeTypeHint?: string): Promise<{ objectPath: string; mimeType: string }> {
    const fileRes = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const headerMime = (fileRes.headers['content-type'] as string | undefined)?.split(';')[0].trim();
    const mimeType = mimeTypeHint || headerMime || 'application/octet-stream';
    const objectPath = await storageService.uploadBuffer(Buffer.from(fileRes.data), mimeType);
    return { objectPath, mimeType };
  }
}

export const mediaService = new MediaService();
