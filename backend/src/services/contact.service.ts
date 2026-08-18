import prisma from '../config/database';
import { buildContactsExcel, ContactExportRow } from '../utils/excel.util';

export interface ExportContactsOptions {
  /** A label id, or the sentinel 'UNLABELED' for contacts with no labels at all. */
  labelId?: string;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class ContactService {
  /**
   * Build an Excel export of contacts, optionally filtered by label.
   */
  async exportContacts(options: ExportContactsOptions = {}): Promise<Buffer> {
    const { labelId } = options;

    const where =
      labelId === 'UNLABELED'
        ? { labels: { none: {} } }
        : labelId
          ? { labels: { some: { labelId } } }
          : {};

    const contacts = await prisma.contact.findMany({
      where,
      select: {
        name: true,
        phoneNumber: true,
        createdAt: true,
        labels: { include: { label: { select: { name: true } } } },
        conversations: {
          select: { lastMessageAt: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows: ContactExportRow[] = contacts.map(contact => ({
      name: contact.name || contact.phoneNumber,
      phoneNumber: contact.phoneNumber,
      labels: contact.labels.map(cl => cl.label.name).join(', '),
      lastMessageAt: formatDate(contact.conversations[0]?.lastMessageAt),
      contactSince: formatDate(contact.createdAt),
    }));

    return buildContactsExcel(rows);
  }
}

export const contactService = new ContactService();
