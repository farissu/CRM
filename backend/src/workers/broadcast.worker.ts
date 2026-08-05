import { Worker, Job } from 'bullmq';
import { BroadcastStatus, BroadcastRecipientStatus, MessageDirection, MessageType, MessageStatus } from '@prisma/client';
import { redisConnection } from '../config/redis';
import prisma from '../config/database';
import { whatsAppService } from '../services/whatsapp.service';
import { conversationService } from '../services/conversation.service';
import { broadcastService } from '../services/broadcast.service';
import { io } from '../index';
import type { BroadcastJobData } from '../queues/broadcast.queue';
import { extractHeaderMedia, hasMediaHeader } from '../utils/template-media.util';

const SEND_CONCURRENCY = 5;

interface RecipientToSend {
  id: string;
  phoneNumber: string;
  name: string | null;
  variables: unknown;
}

interface RenderableComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[] };
}

function substituteVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => variables[n] ?? `{{${n}}}`);
}

/**
 * Renders the message text as the recipient actually received it on WhatsApp
 * (header + body + footer, with {{n}} placeholders substituted), instead of a
 * generic "[Broadcast] <template name>" placeholder.
 */
function renderTemplateText(components: unknown, variables: Record<string, string>): string {
  const list = (components as RenderableComponent[] | null) ?? [];
  const header = list.find(c => c.type === 'HEADER' && c.format === 'TEXT');
  const body = list.find(c => c.type === 'BODY');
  const footer = list.find(c => c.type === 'FOOTER');

  const parts: string[] = [];
  if (header?.text) parts.push(substituteVariables(header.text, variables));
  if (body?.text) parts.push(substituteVariables(body.text, variables));
  if (footer?.text) parts.push(footer.text);

  return parts.join('\n\n');
}

async function sendToRecipient(
  broadcast: { id: string; template: { name: string; language: string; components: unknown } },
  recipient: RecipientToSend,
  uploadedHeaderMedia: { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; id: string; link: string } | undefined
) {
  const variables = (recipient.variables as Record<string, string> | null) ?? {};
  const bodyParams = Object.keys(variables)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => variables[key]);

  try {
    const waMessageId = await whatsAppService.sendTemplateMessage({
      to: recipient.phoneNumber,
      templateName: broadcast.template.name,
      language: broadcast.template.language,
      bodyParams,
      headerMedia: uploadedHeaderMedia,
    });

    const conversation = await conversationService.getOrCreateConversation(
      recipient.phoneNumber,
      recipient.name ?? undefined
    );

    const lastMessageText = renderTemplateText(broadcast.template.components, variables) || `[Broadcast] ${broadcast.template.name}`;
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        text: lastMessageText,
        messageType: uploadedHeaderMedia ? MessageType[uploadedHeaderMedia.format] : MessageType.TEXT,
        mediaUrl: uploadedHeaderMedia?.link,
        status: MessageStatus.SENT,
        metadata: { waMessageId, broadcastId: broadcast.id },
      },
    });
    await conversationService.updateLastMessage(conversation.id, lastMessageText);

    await broadcastService.markRecipientResult(recipient.id, {
      status: BroadcastRecipientStatus.SENT,
      messageId: message.id,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await broadcastService.markRecipientResult(recipient.id, {
      status: BroadcastRecipientStatus.FAILED,
      error: errorMessage,
    });
  }
}

async function processBroadcast(job: Job<BroadcastJobData>) {
  const { broadcastId } = job.data;

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { template: true },
  });
  if (!broadcast) return;

  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: BroadcastStatus.ON_QUEUE } });

  const recipients = await prisma.broadcastRecipient.findMany({
    where: { broadcastId, status: BroadcastRecipientStatus.PENDING },
  });

  // Media headers are uploaded once per broadcast (not once per recipient) — WhatsApp
  // media ids are reusable across many outbound messages.
  let uploadedHeaderMedia: { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; id: string; link: string } | undefined;
  if (hasMediaHeader(broadcast.template.components)) {
    const headerMedia = extractHeaderMedia(broadcast.template.components);
    if (!headerMedia) {
      const error = 'Template header media link is not ready yet — open WhatsApp Templates to refresh it, then try again.';
      await Promise.all(recipients.map(r => broadcastService.markRecipientResult(r.id, { status: BroadcastRecipientStatus.FAILED, error })));
      await broadcastService.finalizeBroadcastStatus(broadcastId);
      io.emit('broadcast_updated', { broadcastId });
      return;
    }

    try {
      const mediaId = await whatsAppService.uploadMediaFromUrl(headerMedia.link);
      uploadedHeaderMedia = { format: headerMedia.format, id: mediaId, link: headerMedia.link };
    } catch (err: unknown) {
      const error = `Failed to upload header media: ${err instanceof Error ? err.message : 'Unknown error'}`;
      await Promise.all(recipients.map(r => broadcastService.markRecipientResult(r.id, { status: BroadcastRecipientStatus.FAILED, error })));
      await broadcastService.finalizeBroadcastStatus(broadcastId);
      io.emit('broadcast_updated', { broadcastId });
      return;
    }
  }

  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: BroadcastStatus.SENDING } });

  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const batch = recipients.slice(i, i + SEND_CONCURRENCY);
    await Promise.all(batch.map(recipient => sendToRecipient(broadcast, recipient, uploadedHeaderMedia)));
  }

  await broadcastService.finalizeBroadcastStatus(broadcastId);
  io.emit('broadcast_updated', { broadcastId });
}

export const broadcastWorker = new Worker<BroadcastJobData>('broadcast', processBroadcast, {
  connection: redisConnection,
});

broadcastWorker.on('failed', (job, err) => {
  console.error(`[BroadcastWorker] Job ${job?.id} failed:`, err);
});
