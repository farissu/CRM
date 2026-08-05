'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, Search, Filter as FilterIcon, Plus, Calendar, Hourglass, List, Send, CheckSquare, XCircle, Ban } from 'lucide-react';
import { format } from 'date-fns';
import type { Broadcast, BroadcastStatus } from '@/types';
import { broadcastApi } from '@/lib/api';
import CreateBroadcastModal from './CreateBroadcastModal';
import SendBroadcastWizard from './SendBroadcastWizard';

const PAGE_SIZE = 10;

const STATUS_TABS: { key: BroadcastStatus | 'ALL'; label: string; icon: typeof Calendar }[] = [
  { key: 'ALL', label: 'All Status', icon: Megaphone },
  { key: 'SCHEDULED', label: 'Scheduled', icon: Calendar },
  { key: 'PREPARING', label: 'Preparing', icon: Hourglass },
  { key: 'ON_QUEUE', label: 'On Queue', icon: List },
  { key: 'SENDING', label: 'Sending', icon: Send },
  { key: 'FINISHED', label: 'Finished', icon: CheckSquare },
  { key: 'UNFINISHED', label: 'Unfinished', icon: Send },
  { key: 'FAILED', label: 'Failed', icon: XCircle },
  { key: 'CANCELED', label: 'Canceled', icon: Ban },
];

const STATUS_COLORS: Record<BroadcastStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  ON_QUEUE: 'bg-yellow-100 text-yellow-700',
  SENDING: 'bg-[#e8f5f3] text-[#2d9c8f]',
  FINISHED: 'bg-green-100 text-green-700',
  UNFINISHED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-500',
};

const STATUS_DOT: Record<BroadcastStatus, string> = {
  SCHEDULED: 'bg-blue-500',
  PREPARING: 'bg-yellow-500',
  ON_QUEUE: 'bg-yellow-500',
  SENDING: 'bg-[#2d9c8f]',
  FINISHED: 'bg-green-500',
  UNFINISHED: 'bg-orange-500',
  FAILED: 'bg-red-500',
  CANCELED: 'bg-gray-400',
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export default function OutboundMessageList() {
  const [statusFilter, setStatusFilter] = useState<BroadcastStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [wizardDraft, setWizardDraft] = useState<{ name: string; label: string } | null>(null);

  const loadBroadcasts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await broadcastApi.getBroadcasts({
        status: statusFilter,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setBroadcasts(res.broadcasts);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBroadcasts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  if (wizardDraft) {
    return (
      <SendBroadcastWizard
        draft={wizardDraft}
        onBack={() => setWizardDraft(null)}
        onSuccess={() => {
          setWizardDraft(null);
          setPage(1);
          void loadBroadcasts();
        }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-6 h-6 text-gray-800" />
        <h2 className="text-2xl font-bold text-gray-900">Outbound Message</h2>
      </div>

      <div className="bg-[#e8f5f3] border border-[#2d9c8f]/20 rounded-xl px-5 py-3 mb-6 text-sm text-gray-700">
        This is where you manage and send WhatsApp broadcast messages to your customers.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 flex-wrap">
          {STATUS_TABS.map(tab => {
            const Icon = tab.icon;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all mb-3 ${
                  active ? 'bg-[#2d9c8f] text-white border-[#2d9c8f]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-b border-gray-100 gap-3 flex-wrap">
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search broadcast name"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 text-gray-600 font-semibold text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              <FilterIcon className="w-4 h-4" />
              Filter
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-[#2d9c8f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all"
            >
              <Plus className="w-4 h-4" />
              New Broadcast
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading broadcasts...</div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📢</div>
            <p className="text-gray-500 text-sm mb-4">
              {search || statusFilter !== 'ALL' ? 'No broadcasts match your filters.' : 'No broadcasts yet. Create your first broadcast to get started.'}
            </p>
            {!search && statusFilter === 'ALL' && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-[#2d9c8f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all"
              >
                <Plus className="w-4 h-4" />New Broadcast
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Broadcast Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Template Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Broadcast Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Send</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivered</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Read</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 text-gray-800 font-medium">{b.name}</td>
                  <td className="px-5 py-4 text-gray-700">{b.template?.name ?? '-'}</td>
                  <td className="px-5 py-4 text-gray-700 font-medium">
                    {b.template ? b.template.category.charAt(0) + b.template.category.slice(1).toLowerCase() : '-'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status]}`} />
                      {formatStatusLabel(b.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700 whitespace-nowrap">{format(new Date(b.createdAt), 'dd/MM/yyyy (HH:mm)')}</td>
                  <td className="px-5 py-4 text-gray-700">Sharing Happiness</td>
                  <td className="px-5 py-4 text-gray-700">{b.sentCount}</td>
                  <td className="px-5 py-4 text-gray-700">{b.deliveredCount}</td>
                  <td className="px-5 py-4 text-gray-700">{b.readCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100">
                <td colSpan={9} className="px-5 py-2.5 text-xs text-gray-400 text-right">
                  {page} / {totalPages} · {total} broadcasts
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <CreateBroadcastModal
        isOpen={showModal}
        onCancel={() => setShowModal(false)}
        onNext={draft => { setShowModal(false); setWizardDraft(draft); }}
      />
    </div>
  );
}
