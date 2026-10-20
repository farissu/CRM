import { MessageDirection, MessageType } from '@prisma/client';

// How far back to look for the last agent reply; plenty for any real conversation.
export const PENDING_LOOKBACK_MESSAGES = 30;

// Closing/acknowledgement words ("Aamiin", "Alhamdulillah", ...) in any spelling
// variant — a reply to these would just restart the conversation.
export const CLOSING_KEYWORD_PATTERN = /\b(a+m+i+n+|al+hamdul+il+a+h?)\b/i;

// These open a donation-specific flow (consultation/confirmation) that always needs a
// human, whatever else the message contains.
export const DONATION_FLOW_PREFIXES = [
  'Halo tim SharingHappiness, Saya mau konsultasi donasi dengan No donasi',
  'Halo tim SharingHappiness, Saya mau konfirmasi donasi',
];

export function hasClosingKeyword(text: string): boolean {
  return CLOSING_KEYWORD_PATTERN.test(text);
}

export function startsDonationFlow(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return DONATION_FLOW_PREFIXES.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

/**
 * A customer message that just closes the conversation — a sticker, or text containing
 * Aamiin/Alhamdulillah — as opposed to one starting a donation flow.
 */
export function isClosingMessage(text: string, type: MessageType): boolean {
  if (startsDonationFlow(text)) return false;
  return type === MessageType.STICKER || hasClosingKeyword(text);
}

export interface ConversationMessage {
  direction: MessageDirection;
  text: string | null;
  caption: string | null;
  messageType: MessageType;
  metadata: unknown;
}

export interface PendingCustomerMessage {
  text: string;
  type: MessageType;
}

/**
 * Customer messages sent since the last real agent reply, newest first. Expects
 * `newestFirst` ordered by timestamp descending. Outside-hours auto-replies don't count
 * as a reply, so messages before one are still pending.
 */
export function pendingCustomerMessages(newestFirst: readonly ConversationMessage[]): PendingCustomerMessage[] {
  const pending: PendingCustomerMessage[] = [];
  for (const m of newestFirst) {
    const isAutoReply = (m.metadata as { autoReply?: boolean } | null)?.autoReply === true;
    if (m.direction === MessageDirection.OUTBOUND && !isAutoReply) break;
    if (m.direction === MessageDirection.INBOUND) pending.push({ text: m.text || m.caption || '', type: m.messageType });
  }
  return pending;
}

/**
 * True when there is something pending and all of it is closing messages — i.e. nothing
 * the customer asked is still waiting for an answer. "Kak mau tanya rekening" followed by
 * a sticker is not closed.
 */
export function onlyClosingMessagesPending(pending: readonly PendingCustomerMessage[]): boolean {
  return pending.length > 0 && pending.every((m) => isClosingMessage(m.text, m.type));
}
