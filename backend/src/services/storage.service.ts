import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, GCS_BUCKET, GCS_FOLDER_PREFIX } from '../config/storage';

const SIGNED_URL_TTL_SECONDS = 15 * 60;

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

export class StorageService {
  async uploadBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    const ext = MIME_TO_EXT[mimeType] ?? 'bin';
    const objectPath = `${GCS_FOLDER_PREFIX}/${randomUUID()}.${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: GCS_BUCKET,
      Key: objectPath,
      Body: buffer,
      ContentType: mimeType,
    }));

    return objectPath;
  }

  async getSignedUrl(objectPath: string): Promise<string> {
    return getS3SignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: GCS_BUCKET, Key: objectPath }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );
  }
}

export const storageService = new StorageService();
