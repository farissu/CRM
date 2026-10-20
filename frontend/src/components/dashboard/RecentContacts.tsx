'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import DashboardCard, { EmptyState } from './DashboardCard';
import { formatNumber, initials } from './dashboardFormat';
import { contactApi } from '@/lib/api';
import type { Conversation, Label } from '@/types';

const MAX_VISIBLE_CONTACTS = 8;
const UNLABELED = 'UNLABELED';

interface ContactRow {
  id: string;
  name: string;
  phoneNumber: string;
  labels: Label[];
  lastMessageAt: string;
}

/**
 * One row per contact (a contact can have several conversations over time), keeping each
 * contact's most recent conversation for the "last activity" column, filtered by the same
 * label the export button will use.
 */
function toContactRows(conversations: Conversation[], labelId: string): ContactRow[] {
  const byContact = new Map<string, ContactRow>();
  for (const conv of conversations) {
    const contact = conv.contact;
    if (!contact) continue;
    const existing = byContact.get(contact.id);
    if (!existing || new Date(conv.lastMessageAt) > new Date(existing.lastMessageAt)) {
      byContact.set(contact.id, {
        id: contact.id,
        name: contact.name || contact.phoneNumber,
        phoneNumber: contact.phoneNumber,
        labels: contact.labels || [],
        lastMessageAt: conv.lastMessageAt,
      });
    }
  }

  const rows = Array.from(byContact.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
  if (!labelId) return rows;
  if (labelId === UNLABELED) return rows.filter((row) => row.labels.length === 0);
  return rows.filter((row) => row.labels.some((label) => label.id === labelId));
}

interface RecentContactsProps {
  conversations: Conversation[];
  labels: Label[];
  totalContacts: number;
  newContacts: number;
  periodLabel: string;
}

export default function RecentContacts({ conversations, labels, totalContacts, newContacts, periodLabel }: RecentContactsProps) {
  const [labelId, setLabelId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const rows = useMemo(() => toContactRows(conversations, labelId), [conversations, labelId]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      const blob = await contactApi.exportContacts(labelId || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export contacts:', error);
      setExportError('Gagal mengunduh kontak. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardCard
      title="Kontak Terbaru"
      subtitle={`${formatNumber(totalContacts)} kontak · ${formatNumber(newContacts)} baru (${periodLabel})`}
      headerRight={
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
            className="text-sm border border-saas-border rounded-lg px-3 py-1.5 text-saas-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Kontak</option>
            <option value={UNLABELED}>Tanpa Label</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>{label.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{exporting ? 'Mengunduh...' : 'Ekspor'}</span>
          </button>
        </div>
      }
    >
      {exportError && <p className="text-sm text-red-600 mb-3">{exportError}</p>}
      {rows.length === 0 ? (
        <EmptyState message="Tidak ada kontak untuk filter ini" heightClassName="h-24" />
      ) : (
        <>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rows.slice(0, MAX_VISIBLE_CONTACTS).map((row) => (
              <ContactItem key={row.id} row={row} />
            ))}
          </ul>
          {rows.length > MAX_VISIBLE_CONTACTS && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Menampilkan {MAX_VISIBLE_CONTACTS} dari {formatNumber(rows.length)} kontak, gunakan Ekspor untuk daftar lengkap.
            </p>
          )}
        </>
      )}
    </DashboardCard>
  );
}

function ContactItem({ row }: { row: ContactRow }) {
  return (
    <li className="flex items-center justify-between gap-3 p-3 bg-saas-bg rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-saas-200 text-saas-800 flex items-center justify-center text-xs font-bold shrink-0">
          {initials(row.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-saas-text-primary truncate">{row.name}</p>
          <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
            {row.labels.length > 0 ? (
              row.labels.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
                >
                  {label.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400">{row.phoneNumber}</span>
            )}
          </div>
        </div>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">
        {formatDistanceToNow(new Date(row.lastMessageAt), { addSuffix: true, locale: idLocale })}
      </span>
    </li>
  );
}
