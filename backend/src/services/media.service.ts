import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

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
    const ext = MIME_TO_EXT[resolvedMime] ?? 'bin';
    const filename = `${mediaId}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    const fileRes = await axios.get<NodeJS.ReadableStream>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'stream',
    });

    await pipeline(fileRes.data, fs.createWriteStream(filepath));

    return `/uploads/${filename}`;
  }
}

export const mediaService = new MediaService();
