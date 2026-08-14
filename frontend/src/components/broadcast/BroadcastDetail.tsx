'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Send, CheckCircle2, CheckCheck, XCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import type { Broadcast, BroadcastStatus, TemplateComponent } from '@/types';
import { broadcastApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import TemplateMessagePreview from './TemplateMessagePreview';

interface BroadcastDetailProps {
  broadcastId: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<BroadcastStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  ON_QUEUE: 'bg-yellow-100 text-yellow-700',
  SENDING: 'bg-[#eef6ff] text-[#597ea3]',
  FINISHED: 'bg-green-100 text-green-700',
  UNFINISHED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-500',
};

const AUDIENCE_LABELS: Record<string, string> = {
  SINGLE_NUMBER: 'Single Number',
  CSV: 'By CSV',
  CONDITION: 'By Condition',
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default function BroadcastDetail({ broadcastId, onBack }: BroadcastDetailProps) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBroadcast = async () => {
      try {
        setError(null);
        const res = await broadcastApi.getBroadcast(broadcastId);
        if (!cancelled) setBroadcast(res.broadcast);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load broadcast');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void loadBroadcast();

    // Broadcast sending runs in a background worker — re-fetch on its progress/status
    // signal so Sent/Delivered/Read/Failed and the status badge update live.
    const handleBroadcastUpdated = (data: { broadcastId: string }) => {
      if (data.broadcastId === broadcastId) void loadBroadcast();
    };
    socketClient.onBroadcastUpdated(handleBroadcastUpdated);

    return () => {
      cancelled = true;
      socketClient.offBroadcastUpdated(handleBroadcastUpdated);
    };
  }, [broadcastId]);

  const recipients = broadcast?.recipients ?? [];
  // deliveredCount is already a cumulative "reached delivered-or-better" total — a read
  // message was necessarily delivered first, so it's counted there too. Adding readCount
  // on top double-counts every recipient who progressed past delivered to read.
  const successful = broadcast?.deliveredCount ?? 0;
  const failed = broadcast?.failedCount ?? 0;
  // failedCount recipients were already excluded from sentCount when they failed (moved
  // out via decrement), so subtracting `failed` again here would double-subtract them.
  const inProgress = Math.max(0, (broadcast?.sentCount ?? 0) - successful);

  const handleDownloadLog = () => {
    if (!broadcast) return;
    const headers = ['No', 'Customer Name', 'Phone Number', 'Broadcast Time', 'Status', 'Reason', 'Variable', 'WhatsApp Message ID'];
    const rows = recipients.map((r, i) => [
      String(i + 1),
      r.name ?? '',
      r.phoneNumber,
      r.sentAt ? format(new Date(r.sentAt), 'dd/MM/yyyy HH:mm') : '',
      formatStatusLabel(r.status),
      r.error ?? '',
      r.variables ? Object.values(r.variables).join(', ') : '',
      r.message?.metadata?.waMessageId ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${broadcast.name}_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-sm mb-4 hover:opacity-80 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
        Outbound Message List
      </button>

      {loading && <div className="text-sm text-gray-400 py-16 text-center">Loading broadcast...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {broadcast && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[broadcast.status]}`}>
              {formatStatusLabel(broadcast.status)}
            </span>
            <h2 className="text-xl font-bold text-gray-900">{broadcast.name}</h2>
          </div>

          <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm">
                {[
                  ['Template Name', broadcast.template?.name ?? '-'],
                  [
                    'Template Category',
                    broadcast.template ? broadcast.template.category.charAt(0) + broadcast.template.category.slice(1).toLowerCase() : '-',
                  ],
                  ['Send Broadcast Time', format(new Date(broadcast.createdAt), 'dd/MM/yyyy, HH:mm')],
                  [
                    'Broadcast Schedule',
                    format(new Date(broadcast.scheduledAt ?? broadcast.createdAt), 'dd/MM/yyyy, HH:mm'),
                  ],
                  ['Broadcast by', 'Sharing Happiness'],
                  ['Audience Type', AUDIENCE_LABELS[broadcast.audienceType] ?? broadcast.audienceType],
                ].map(([k, v]) => (
                  <div key={k} className="flex border-b border-gray-100 last:border-0">
                    <div className="px-5 py-3 text-gray-500 w-48 shrink-0">{k}</div>
                    <div className="px-5 py-3 font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-800 mb-4">Broadcast Metrics</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total of Successful Broadcast</p>
                    <p className="text-2xl font-bold text-gray-900">{successful}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total of Failed Broadcast</p>
                    <p className="text-2xl font-bold text-gray-900">{failed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total of In-progress Broadcast</p>
                    <p className="text-2xl font-bold text-gray-900">{inProgress}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Sent', value: broadcast.sentCount, icon: Send, color: 'text-blue-500' },
                    { label: 'Delivered', value: broadcast.deliveredCount, icon: CheckCircle2, color: 'text-[#597ea3]' },
                    { label: 'Read', value: broadcast.readCount, icon: CheckCheck, color: 'text-green-600' },
                    { label: 'Failed', value: broadcast.failedCount, icon: XCircle, color: 'text-red-500' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700 text-sm">
                        <row.icon className={`w-4 h-4 ${row.color}`} />
                        {row.label}
                      </div>
                      <span className="font-bold text-gray-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#ede7dc] rounded-xl p-4 sticky top-0">
              <p className="font-bold text-gray-800 mb-3">Preview</p>
              <div className="bg-white rounded-xl shadow-sm p-4 min-h-[80px]">
                {broadcast.template ? (
                  <TemplateMessagePreview
                    components={(broadcast.template as unknown as { components: TemplateComponent[] }).components}
                    timestamp={format(new Date(broadcast.createdAt), 'HH:mm')}
                  />
                ) : (
                  <p className="text-sm text-gray-300">No template</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Broadcast Logs</h3>
              <button
                onClick={handleDownloadLog}
                className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-sm hover:opacity-80 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download Broadcast Log
              </button>
            </div>
            {recipients.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">No recipients</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Number</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Broadcast Time</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Variable</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp Message ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r, i) => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-5 py-3 text-gray-700">{r.name ?? '-'}</td>
                        <td className="px-5 py-3 text-gray-800">{r.phoneNumber}</td>
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                          {r.sentAt ? format(new Date(r.sentAt), 'dd/MM/yyyy (HH:mm)') : '-'}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{formatStatusLabel(r.status)}</td>
                        <td className="px-5 py-3 text-red-500 text-xs max-w-[160px] truncate" title={r.error ?? ''}>{r.error ?? '-'}</td>
                        <td className="px-5 py-3 text-gray-600 text-xs max-w-[200px] truncate">
                          {r.variables ? Object.values(r.variables).join(', ') : '-'}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs max-w-[160px] truncate" title={r.message?.metadata?.waMessageId ?? ''}>
                          {r.message?.metadata?.waMessageId ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
