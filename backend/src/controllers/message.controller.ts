import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { messageService } from '../services/message.service';
import { mediaService } from '../services/media.service';
import { storageService } from '../services/storage.service';
import { GCS_FOLDER_PREFIX } from '../config/storage';
import prisma from '../config/database';

const MESSAGE_TYPE_BY_MIME_PREFIX: Array<[string, string]> = [
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
];

function resolveMessageTypeFromMime(mimeType: string): string {
  const match = MESSAGE_TYPE_BY_MIME_PREFIX.find(([prefix]) => mimeType.startsWith(prefix));
  return match?.[1] ?? 'document';
}

interface WhatsAppContact {
  wa_id: string;
  profile?: { name?: string };
}

interface WhatsAppMediaPayload {
  id: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  timestamp?: string;
  text?: { body: string };
  image?: WhatsAppMediaPayload;
  video?: WhatsAppMediaPayload;
  document?: WhatsAppMediaPayload;
  audio?: WhatsAppMediaPayload;
  sticker?: WhatsAppMediaPayload;
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}

function extractContactName(contacts: WhatsAppContact[] | undefined, from: string): string {
  if (!contacts) return from;
  const match = contacts.find(c => c.wa_id === from);
  return match?.profile?.name ?? from;
}

async function extractMediaContent(message: WhatsAppMessage): Promise<{
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  caption?: string;
}> {
  const type = message.type;

  async function downloadOrFallback(payload: WhatsAppMediaPayload): Promise<string> {
    try {
      return await mediaService.downloadAndSave(payload.id, payload.mime_type);
    } catch {
      return payload.id;
    }
  }

  if (type === 'text' && message.text) {
    return { text: message.text.body };
  }

  if (type === 'image' && message.image) {
    const { mime_type, caption } = message.image;
    return { text: caption ?? '', mediaUrl: await downloadOrFallback(message.image), mediaType: mime_type, caption };
  }

  if (type === 'video' && message.video) {
    const { mime_type, caption } = message.video;
    return { text: caption ?? '', mediaUrl: await downloadOrFallback(message.video), mediaType: mime_type, caption };
  }

  if (type === 'document' && message.document) {
    const { mime_type, caption, filename } = message.document;
    return { text: caption ?? '', mediaUrl: await downloadOrFallback(message.document), mediaType: mime_type, fileName: filename, caption };
  }

  if (type === 'audio' && message.audio) {
    return { text: '', mediaUrl: await downloadOrFallback(message.audio), mediaType: message.audio.mime_type };
  }

  if (type === 'sticker' && message.sticker) {
    return { text: '', mediaUrl: await downloadOrFallback(message.sticker), mediaType: message.sticker.mime_type };
  }

  if (type === 'button' && message.button) {
    return { text: message.button.text };
  }

  if (type === 'interactive' && message.interactive) {
    const title = message.interactive.button_reply?.title ?? message.interactive.list_reply?.title ?? '';
    return { text: title };
  }

  return { text: '' };
}

async function processWhatsAppMessage(message: WhatsAppMessage, contacts: WhatsAppContact[] | undefined) {
  if (!message.from) return;
  const timestamp = message.timestamp ? parseInt(message.timestamp) * 1000 : Date.now();
  const { text, mediaUrl, mediaType, fileName, caption } = await extractMediaContent(message);
  const contactName = extractContactName(contacts, message.from);

  await messageService.receiveMessage({
    phoneNumber: message.from,
    text,
    contactName,
    timestamp: new Date(timestamp),
    messageType: message.type,
    externalId: message.id,
    mediaUrl,
    mediaType,
    fileName,
    caption,
  });
}

async function forwardToWebhook(payload: unknown) {
  try {
    const companies = await prisma.company.findMany({
      where: { webhookUrl: { not: null } },
      select: { webhookUrl: true },
    });
    await Promise.allSettled(
      companies
        .filter(c => c.webhookUrl)
        .map(c => axios.post(c.webhookUrl!, payload, { timeout: 5000 }))
    );
  } catch {
    // forwarding failure must not affect the main flow
  }
}

export class MessageController {
  async getMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const result = await messageService.getMessages(id, parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch messages', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const { conversationId, text, senderId } = req.body;
      if (!conversationId || !text || !senderId) {
        res.status(400).json({ error: 'conversationId, text, and senderId are required' });
        return;
      }
      const message = await messageService.sendMessage({ conversationId, text, senderId });
      res.status(201).json(message);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to send message', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async sendExternalMessage(req: Request, res: Response) {
    try {
      const { to, text, contactName } = req.body as { to: string; text: string; contactName?: string };
      const message = await messageService.sendMessageByPhone({ phoneNumber: to, text, contactName });
      res.status(201).json(message);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to send message', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  }

  async handleWebhook(req: Request, res: Response) {
    try {
      const body = req.body;

      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          for (const change of entry.changes ?? []) {
            const value = change.value;
            for (const message of value.messages ?? []) {
              await processWhatsAppMessage(message as WhatsAppMessage, value.contacts);
            }
          }
        }
      } else if (body.from && body.text) {
        await messageService.receiveMessage({
          phoneNumber: body.from,
          text: body.text,
          contactName: body.name,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
        });
      } else if (body.body?.messages) {
        for (const message of body.body.messages) {
          if (!message.from) continue;
          const text = message.type === 'text' ? message.text?.body ?? '' : '';
          const contactName = extractContactName(body.body.contacts, message.from);
          await messageService.receiveMessage({
            phoneNumber: message.from,
            text,
            contactName,
            timestamp: message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : undefined,
          });
        }
      }

      // Forward to company webhookUrl (e.g. n8n) if configured
      void forwardToWebhook(body);

      res.status(200).json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to process webhook', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async uploadMedia(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    try {
      const objectPath = await storageService.uploadBuffer(file.buffer, file.mimetype);
      res.status(201).json({
        mediaUrl: objectPath,
        mediaType: file.mimetype,
        messageType: resolveMessageTypeFromMime(file.mimetype),
        fileName: file.originalname,
        fileSize: file.size,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to upload media', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  async getGcsMedia(req: Request, res: Response) {
    const token = (req.query.token as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      res.status(401).json({ error: 'Invalid token' }); return;
    }

    const objectPath = req.params.objectPath;
    if (!objectPath || !objectPath.startsWith(GCS_FOLDER_PREFIX)) {
      res.status(400).json({ error: 'Invalid media path' }); return;
    }

    try {
      const signedUrl = await storageService.getSignedUrl(objectPath);
      res.redirect(signedUrl);
    } catch {
      res.status(404).json({ error: 'Media not found or expired' });
    }
  }

  async getMedia(req: Request, res: Response) {
    const token = (req.query.token as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      res.status(401).json({ error: 'Invalid token' }); return;
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'WhatsApp not configured' }); return; }

    try {
      const metaRes = await axios.get<{ url: string; mime_type: string }>(
        `https://graph.facebook.com/v19.0/${req.params.mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const { url, mime_type } = metaRes.data;
      const mediaRes = await axios.get<NodeJS.ReadableStream>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
      });
      res.setHeader('Content-Type', mime_type || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      mediaRes.data.pipe(res);
    } catch {
      res.status(404).json({ error: 'Media not found or expired' });
    }
  }
}

export const messageController = new MessageController();
