import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.GCS_REGION || 'auto',
  endpoint: process.env.GCS_ENDPOINT || 'https://storage.googleapis.com',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.GCS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.GCS_SECRET_ACCESS_KEY || '',
  },
});

export const GCS_BUCKET = process.env.GCS_BUCKET || '';
export const GCS_FOLDER_PREFIX = process.env.GCS_FOLDER_PREFIX || 'Waku/messages';
