// One-off backfill for the auto-resolve rule (src/services/autoResolve.service.ts):
// conversations already sitting in "Belum Dibalas" whose customer messages since the last
// agent reply are only closing messages (sticker / Aamiin / Alhamdulillah) get resolved and
// assigned to the PIC in AUTO_RESOLVE_AGENT_ID.
//
// Dry run by default — prints counts and samples, changes nothing:
//   npx ts-node scripts/backfill-auto-resolve.ts
// Apply to the "safe" group only:
//   npx ts-node scripts/backfill-auto-resolve.ts --apply
// Also resolve "mixed" ones (last message is closing, but an earlier unanswered customer
// message is not — e.g. a question followed by a sticker):
//   npx ts-node scripts/backfill-auto-resolve.ts --apply --include-mixed
import { PrismaClient, ConversationStatus, MessageDirection, MessageType } from '@prisma/client';
import { isClosingMessage } from '../src/utils/closing-message.util';

const prisma = new PrismaClient();
// Enough history to reach the last agent reply in practically every conversation.
const MESSAGES_TO_INSPECT = 30;
const SAMPLE_SIZE = 8;
const SAMPLE_TEXT_LENGTH = 60;

interface PendingMessage {
  text: string;
  type: MessageType;
}

interface Candidate {
  id: string;
  name: string;
  pending: PendingMessage[];
}

const isApply = process.argv.includes('--apply');
const includeMixed = process.argv.includes('--include-mixed');

/** Customer messages since the last real agent reply (outside-hours auto-replies don't count). */
function pendingInbound(messages: Array<{ direction: MessageDirection; text: string | null; caption: string | null; messageType: MessageType; metadata: unknown }>): PendingMessage[] {
  const pending: PendingMessage[] = [];
  for (const m of messages) {
    const isAutoReply = (m.metadata as { autoReply?: boolean } | null)?.autoReply === true;
    if (m.direction === MessageDirection.OUTBOUND && !isAutoReply) break;
    if (m.direction === MessageDirection.INBOUND) pending.push({ text: m.text || m.caption || '', type: m.messageType });
  }
  return pending;
}

function describe(msg: PendingMessage): string {
  if (msg.type === MessageType.STICKER) return '[stiker]';
  if (msg.type !== MessageType.TEXT && !msg.text) return `[${msg.type.toLowerCase()}]`;
  return JSON.stringify(msg.text.length > SAMPLE_TEXT_LENGTH ? `${msg.text.slice(0, SAMPLE_TEXT_LENGTH)}…` : msg.text);
}

function printSamples(title: string, rows: Candidate[]) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, SAMPLE_SIZE)) {
    // Oldest first, so the unanswered question (if any) reads before the closing message.
    console.log(`  - ${row.name}: ${[...row.pending].reverse().map(describe).join(' → ')}`);
  }
}

async function main() {
  const picAgentId = process.env.AUTO_RESOLVE_AGENT_ID?.trim();
  if (!picAgentId) throw new Error('AUTO_RESOLVE_AGENT_ID is not set');
  const pic = await prisma.agent.findFirst({ where: { id: picAgentId, isActive: true }, select: { id: true, name: true } });
  if (!pic) throw new Error(`AUTO_RESOLVE_AGENT_ID ${picAgentId} is not an active agent`);

  // Same population as the inbox "Belum Dibalas" tab.
  const awaitingWhere = { status: ConversationStatus.OPEN, lastMessageDirection: MessageDirection.INBOUND };
  const conversations = await prisma.conversation.findMany({
    where: awaitingWhere,
    select: {
      id: true,
      contact: { select: { name: true, phoneNumber: true } },
      messages: {
        orderBy: { timestamp: 'desc' },
        take: MESSAGES_TO_INSPECT,
        select: { direction: true, text: true, caption: true, messageType: true, metadata: true },
      },
    },
  });

  const safe: Candidate[] = [];
  const mixed: Candidate[] = [];
  for (const conv of conversations) {
    const pending = pendingInbound(conv.messages);
    if (pending.length === 0 || !isClosingMessage(pending[0].text, pending[0].type)) continue;
    const candidate = { id: conv.id, name: conv.contact.name || 'Tanpa nama', pending };
    (pending.every((m) => isClosingMessage(m.text, m.type)) ? safe : mixed).push(candidate);
  }

  console.log(`PIC: ${pic.name}`);
  console.log(`Percakapan di "Belum Dibalas": ${conversations.length}`);
  printSamples('AMAN (semua pesan pelanggan yang belum dibalas = stiker/Aamiin/Alhamdulillah)', safe);
  printSamples('CAMPUR (pesan terakhir penutup, tapi ada pesan lain sebelumnya yang belum dibalas)', mixed);

  if (!isApply) {
    console.log('\nDry run — tidak ada yang diubah. Jalankan dengan --apply untuk me-resolve grup AMAN.');
    return;
  }

  const ids = [...safe, ...(includeMixed ? mixed : [])].map((c) => c.id);
  // Re-check the awaiting condition so a conversation answered meanwhile is left alone.
  const result = await prisma.conversation.updateMany({
    where: { id: { in: ids }, ...awaitingWhere },
    data: { status: ConversationStatus.RESOLVED, assignedAgentId: pic.id, unreadCount: 0 },
  });
  console.log(`\nResolved ${result.count} percakapan → PIC ${pic.name}${includeMixed ? ' (termasuk grup CAMPUR)' : ''}.`);
}

main()
  .catch((err: unknown) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
