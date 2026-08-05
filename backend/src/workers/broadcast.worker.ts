import { Worker, Job } from 'bullmq';
import { BroadcastStatus, BroadcastRecipientStatus, MessageDirection, MessageType, MessageStatus } from '@prisma/client';
import { redisConnection } from '../config/redis';
import prisma from '../config/database';
import { whatsAppService } from '../services/whatsapp.service';
import { conversationService } from '../services/conversation.service';
import { broadcastService } from '../services/broadcast.service';
import { io } from '../index';
import type { BroadcastJobData } from '../queues/broadcast.queue';

const SEND_CONCURRENCY = 5;

interface RecipientToSend {
  id: string;
  phoneNumber: string;
  name: string | null;
  variables: unknown;
}

async function sendToRecipient(
  broadcast: { id: string; template: { name: string; language: string } },
  recipient: RecipientToSend
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
    });

    const conversation = await conversationService.getOrCreateConversation(
      recipient.phoneNumber,
      recipient.name ?? undefined
    );

    const lastMessageText = `[Broadcast] ${broadcast.template.name}`;
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        text: lastMessageText,
        messageType: MessageType.TEXT,
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

  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: BroadcastStatus.SENDING } });

  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const batch = recipients.slice(i, i + SEND_CONCURRENCY);
    await Promise.all(batch.map(recipient => sendToRecipient(broadcast, recipient)));
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
