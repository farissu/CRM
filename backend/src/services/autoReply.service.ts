import { MessageDirection, MessageStatus, MessageType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { io } from '../index';
import { whatsAppService } from './whatsapp.service';

const SETTINGS_ID = 'singleton';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Same convention as dashboard.service.ts — business hours are configured and
// evaluated in the Asia/Jakarta wall-clock timezone.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

// These open a donation-specific flow (consultation/confirmation) that shouldn't be
// interrupted by the generic outside-hours notice, regardless of when they arrive.
const EXCLUDED_MESSAGE_PREFIXES = [
  'Halo tim SharingHappiness, Saya mau konsultasi donasi dengan No donasi',
  'Halo tim SharingHappiness, Saya mau konfirmasi donasi',
];

export interface AutoReplySettingsInput {
  isEnabled: boolean;
  message: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
}

class AutoReplyService {
  async getSettings() {
    const settings = await prisma.autoReplySettings.findUnique({ where: { id: SETTINGS_ID } });
    return settings ?? {
      id: SETTINGS_ID,
      isEnabled: false,
      message: '',
      workingDays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
      updatedAt: null,
    };
  }

  async updateSettings(input: AutoReplySettingsInput) {
    return prisma.autoReplySettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...input },
      update: { ...input },
    });
  }

  private isOutsideWorkingHours(settings: { workingDays: number[]; startTime: string; endTime: string }, now: Date): boolean {
    const jktWall = new Date(now.getTime() + TZ_OFFSET_MS);
    const weekday = jktWall.getUTCDay();
    if (!settings.workingDays.includes(weekday)) return true;

    const minutesNow = jktWall.getUTCHours() * 60 + jktWall.getUTCMinutes();
    const [startH, startM] = settings.startTime.split(':').map(Number);
    const [endH, endM] = settings.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return minutesNow < startMinutes || minutesNow >= endMinutes;
  }

  /**
   * Sends the outside-business-hours auto-reply for an inbound message, if enabled,
   * currently outside working hours, and not already sent for this conversation in
   * the last 24 hours. Deliberately does not touch lastMessageDirection/lastMessageText
   * on the conversation — the auto-reply must not make the conversation look answered,
   * so it still shows up under "Belum Dibalas" for a human agent to actually handle.
   */
  async maybeSendAutoReply(conversationId: string, phoneNumber: string, inboundText: string): Promise<void> {
    try {
      const trimmed = inboundText.trim().toLowerCase();
      if (EXCLUDED_MESSAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix.toLowerCase()))) return;

      const settings = await this.getSettings();
      if (!settings.isEnabled || !settings.message.trim()) return;
      if (!this.isOutsideWorkingHours(settings, new Date())) return;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { lastAutoReplyAt: true },
      });
      if (!conversation) return;
      if (conversation.lastAutoReplyAt && Date.now() - conversation.lastAutoReplyAt.getTime() < COOLDOWN_MS) return;

      const waMessageId = await whatsAppService.sendMessage({
        to: phoneNumber,
        text: settings.message,
        messageType: 'text',
      });

      const message = await prisma.message.create({
        data: {
          conversationId,
          direction: MessageDirection.OUTBOUND,
          text: settings.message,
          messageType: MessageType.TEXT,
          status: MessageStatus.SENT,
          metadata: { autoReply: true, waMessageId } as Prisma.InputJsonValue,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastAutoReplyAt: new Date() },
      });

      io.emit('message_received', { conversationId, message });
    } catch (err: unknown) {
      // An auto-reply failure must never affect the main inbound-message flow.
      console.error('[AutoReply] Failed to send:', err instanceof Error ? err.message : err);
    }
  }
}

export const autoReplyService = new AutoReplyService();
