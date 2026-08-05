import {
  Prisma,
  BroadcastStatus,
  BroadcastAudienceType,
  BroadcastRecipientStatus,
  MessageStatus,
  TemplateStatus,
} from '@prisma/client';
import prisma from '../config/database';
import { whatsAppService } from './whatsapp.service';
import { parseBroadcastCsv, buildCsvTemplate, type BroadcastCsvRow } from '../utils/csv.util';
import { enqueueBroadcast, cancelBroadcastJob } from '../queues/broadcast.queue';

export interface CreateBroadcastDto {
  companyId: string;
  createdById?: string;
  name: string;
  label?: string;
  templateId: string;
  audienceType: 'SINGLE_NUMBER' | 'CSV';
  phoneNumber?: string;
  variables?: Record<string, string>;
  csvBuffer?: Buffer;
  csvSeparator?: string;
  scheduledAt?: string;
}

export class BroadcastService {
  async createBroadcast(dto: CreateBroadcastDto) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: dto.templateId, companyId: dto.companyId },
    });
    if (!template) throw new Error('Template not found');
    if (template.status !== TemplateStatus.APPROVED) {
      throw new Error('Only APPROVED templates can be used for a broadcast');
    }

    let recipientInputs: BroadcastCsvRow[];
    if (dto.audienceType === 'SINGLE_NUMBER') {
      if (!dto.phoneNumber) throw new Error('phoneNumber is required for Single Number audience');
      recipientInputs = [{ phoneNumber: dto.phoneNumber, variables: dto.variables ?? {} }];
    } else if (dto.audienceType === 'CSV') {
      if (!dto.csvBuffer) throw new Error('CSV file is required for By CSV audience');
      const { rows, errors } = parseBroadcastCsv(dto.csvBuffer, dto.csvSeparator || ',', template);
      if (rows.length === 0) throw new Error(errors.join('; ') || 'CSV has no valid rows');
      recipientInputs = rows;
    } else {
      throw new Error(`Audience type ${dto.audienceType} is not supported yet`);
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const isFuture = scheduledAt ? scheduledAt.getTime() > Date.now() : false;

    const broadcast = await prisma.$transaction(async tx => {
      const created = await tx.broadcast.create({
        data: {
          companyId: dto.companyId,
          name: dto.name,
          label: dto.label,
          templateId: dto.templateId,
          audienceType: dto.audienceType as BroadcastAudienceType,
          status: isFuture ? BroadcastStatus.SCHEDULED : BroadcastStatus.PREPARING,
          scheduledAt,
          totalRecipients: recipientInputs.length,
          createdById: dto.createdById,
        },
      });

      await tx.broadcastRecipient.createMany({
        data: recipientInputs.map(r => ({
          broadcastId: created.id,
          phoneNumber: r.phoneNumber,
          name: r.name,
          variables: r.variables as Prisma.InputJsonValue,
        })),
      });

      return created;
    });

    await enqueueBroadcast(broadcast.id, scheduledAt);

    return broadcast;
  }

  async getBroadcasts(
    companyId: string,
    opts: { status?: string; search?: string; page?: number; limit?: number } = {}
  ) {
    const { status, search, page = 1, limit = 20 } = opts;
    const where: Prisma.BroadcastWhereInput = { companyId };
    if (status && status !== 'ALL') where.status = status as BroadcastStatus;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        include: { template: { select: { name: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.broadcast.count({ where }),
    ]);

    return { broadcasts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getBroadcastById(id: string, companyId: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id, companyId },
      include: {
        template: true,
        recipients: { include: { message: { select: { metadata: true } } } },
      },
    });
    if (!broadcast) throw new Error('Broadcast not found');
    return broadcast;
  }

  async cancelBroadcast(id: string, companyId: string) {
    const broadcast = await prisma.broadcast.findFirst({ where: { id, companyId } });
    if (!broadcast) throw new Error('Broadcast not found');
    if (broadcast.status !== BroadcastStatus.SCHEDULED && broadcast.status !== BroadcastStatus.ON_QUEUE) {
      throw new Error('Only scheduled or queued broadcasts can be canceled');
    }
    await cancelBroadcastJob(id);
    return prisma.broadcast.update({ where: { id }, data: { status: BroadcastStatus.CANCELED } });
  }

  async sendTestMessage(params: { templateId: string; companyId: string; to: string; bodyParams?: string[] }) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: params.templateId, companyId: params.companyId },
    });
    if (!template) throw new Error('Template not found');

    const waMessageId = await whatsAppService.sendTemplateMessage({
      to: params.to,
      templateName: template.name,
      language: template.language,
      bodyParams: params.bodyParams ?? [],
    });

    return { waMessageId };
  }

  async getCsvTemplateContent(templateId: string, companyId: string) {
    const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, companyId } });
    if (!template) throw new Error('Template not found');
    return { filename: `${template.name}_broadcast_template.csv`, content: buildCsvTemplate(template) };
  }

  /**
   * Called by the worker after each per-recipient send attempt.
   */
  async markRecipientResult(
    recipientId: string,
    result: { status: BroadcastRecipientStatus; messageId?: string; error?: string }
  ) {
    const recipient = await prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        status: result.status,
        messageId: result.messageId,
        error: result.error,
        sentAt: result.status === BroadcastRecipientStatus.SENT ? new Date() : undefined,
      },
    });

    if (result.status === BroadcastRecipientStatus.SENT) {
      await prisma.broadcast.update({ where: { id: recipient.broadcastId }, data: { sentCount: { increment: 1 } } });
    } else if (result.status === BroadcastRecipientStatus.FAILED) {
      await prisma.broadcast.update({ where: { id: recipient.broadcastId }, data: { failedCount: { increment: 1 } } });
    }

    return recipient;
  }

  /**
   * Called by the worker once all recipients in a broadcast have been processed.
   */
  async finalizeBroadcastStatus(broadcastId: string) {
    const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return;

    const status =
      broadcast.failedCount === 0
        ? BroadcastStatus.FINISHED
        : broadcast.sentCount === 0
          ? BroadcastStatus.FAILED
          : BroadcastStatus.UNFINISHED;

    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status } });
  }

  /**
   * Called from the WhatsApp delivery-status webhook path (message.service.ts) so a
   * broadcast's Delivered/Read counters reflect real Meta callbacks, not just send attempts.
   * No-op if the message isn't linked to a broadcast recipient.
   */
  async onMessageStatusUpdated(messageId: string, status: MessageStatus) {
    const recipient = await prisma.broadcastRecipient.findUnique({ where: { messageId } });
    if (!recipient) return;

    const recipientStatus =
      status === MessageStatus.DELIVERED
        ? BroadcastRecipientStatus.DELIVERED
        : status === MessageStatus.READ
          ? BroadcastRecipientStatus.READ
          : status === MessageStatus.FAILED
            ? BroadcastRecipientStatus.FAILED
            : undefined;
    if (!recipientStatus) return;

    await prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: recipientStatus } });

    const field =
      recipientStatus === BroadcastRecipientStatus.DELIVERED
        ? 'deliveredCount'
        : recipientStatus === BroadcastRecipientStatus.READ
          ? 'readCount'
          : undefined;
    if (field) {
      await prisma.broadcast.update({ where: { id: recipient.broadcastId }, data: { [field]: { increment: 1 } } });
    }
  }
}

export const broadcastService = new BroadcastService();
