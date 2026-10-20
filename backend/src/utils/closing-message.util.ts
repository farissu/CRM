import { MessageType } from '@prisma/client';

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
