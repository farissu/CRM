'use client';

import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import DashboardCard, { EmptyState } from './DashboardCard';
import ChannelIcon from '@/components/common/ChannelIcon';
import { initials } from './dashboardFormat';
import type { Channel, Conversation } from '@/types';

const MAX_ROWS = 6;
const CHANNEL_LABEL: Record<Channel, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram' };

function statusBadge(conv: Conversation): { label: string; className: string } {
  if (conv.status === 'RESOLVED') return { label: 'Selesai', className: 'bg-emerald-50 text-emerald-600' };
  if (conv.status === 'PENDING') return { label: 'Pending', className: 'bg-violet-50 text-violet-600' };
  if (conv.lastMessageDirection === 'INBOUND') return { label: 'Menunggu', className: 'bg-amber-50 text-amber-600' };
  return { label: 'Terbuka', className: 'bg-blue-50 text-blue-600' };
}

interface RecentConversationsTableProps {
  conversations: Conversation[];
  onViewAll?: () => void;
}

export default function RecentConversationsTable({ conversations, onViewAll }: RecentConversationsTableProps) {
  const rows = conversations.slice(0, MAX_ROWS);

  return (
    <DashboardCard
      title="Percakapan Masuk Terakhir"
      action={onViewAll ? { label: 'Lihat Semua', onClick: onViewAll } : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState message="Belum ada percakapan" />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 bg-saas-bg">
                <th className="py-2.5 px-3 rounded-l-lg">Pelanggan</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Pesan Terakhir</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Agent</th>
                <th className="py-2.5 px-3 rounded-r-lg">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-saas-border">
              {rows.map((conv) => (
                <ConversationRow key={conv.id} conv={conv} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

function ConversationRow({ conv }: { conv: Conversation }) {
  const name = conv.contact?.name || conv.contact?.phoneNumber || 'Tanpa nama';
  const channel = conv.contact?.channel ?? 'WHATSAPP';
  const badge = statusBadge(conv);

  return (
    <tr className="align-middle">
      <td className="py-3 px-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-saas-200 text-saas-800 flex items-center justify-center text-xs font-bold shrink-0">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-saas-text-primary truncate max-w-[160px]">{name}</p>
            {conv.contact?.name && <p className="text-xs text-gray-400 truncate max-w-[160px]">{conv.contact.phoneNumber}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <ChannelIcon channel={channel} className="w-5 h-5" />
          {CHANNEL_LABEL[channel]}
        </span>
      </td>
      <td className="py-3 px-3">
        <p className="text-gray-600 truncate max-w-[200px]" title={conv.lastMessageText ?? ''}>
          {conv.lastMessageText || <span className="italic text-gray-400">Media</span>}
        </p>
      </td>
      <td className="py-3 px-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.className}`}>{badge.label}</span>
      </td>
      <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{conv.assignedAgent?.name ?? <span className="text-gray-400">—</span>}</td>
      <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: idLocale })}
      </td>
    </tr>
  );
}
