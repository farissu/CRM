import prisma from '../config/database';
import { io } from '../index';

const DEFAULT_OUTBOUND_LABEL_NAME = 'Outbound';

export async function getContactWithLabels(contactId: string) {
  return prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      labels: {
        include: {
          label: true,
        },
      },
    },
  });
}

export async function emitContactLabelUpdate(contactId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { contactId },
    include: {
      contact: {
        include: {
          labels: {
            include: {
              label: true,
            },
          },
        },
      },
      assignedAgent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  conversations.forEach((conv) => {
    const transformedConv = {
      ...conv,
      contact: {
        ...conv.contact,
        labels: conv.contact.labels.map(cl => cl.label),
      },
    };
    io.emit('conversation_updated', transformedConv);
  });
}

/**
 * Auto-tags a contact with the default "Outbound" label the first time a broadcast reaches
 * them successfully — but only if they have no labels yet, so it never overrides a label an
 * agent already assigned manually (regardless of whether the contact had chatted before).
 */
export async function applyDefaultOutboundLabel(contactId: string): Promise<void> {
  const hasExistingLabel = await prisma.contactLabel.findFirst({ where: { contactId } });
  if (hasExistingLabel) return;

  const outboundLabel = await prisma.label.findUnique({ where: { name: DEFAULT_OUTBOUND_LABEL_NAME } });
  if (!outboundLabel) return;

  try {
    await prisma.contactLabel.create({ data: { contactId, labelId: outboundLabel.id } });
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'P2002') throw err;
    return;
  }

  await emitContactLabelUpdate(contactId);
}
