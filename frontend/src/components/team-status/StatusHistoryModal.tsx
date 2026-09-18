import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { formatDistanceStrict, format } from 'date-fns';
import { agentApi } from '@/lib/api';
import type { AgentStatusLog } from '@/types';

interface StatusHistoryModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

function formatDuration(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt) : new Date();
  return formatDistanceStrict(new Date(startedAt), end);
}

export default function StatusHistoryModal({ agentId, agentName, onClose }: StatusHistoryModalProps) {
  const [logs, setLogs] = useState<AgentStatusLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await agentApi.getStatusHistory(agentId, page, PAGE_SIZE);
        if (cancelled) return;
        setLogs(response.logs);
        setTotal(response.total);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [agentId, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-soft max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-saas-border">
          <div>
            <h3 className="text-lg font-bold text-saas-text-primary">Activity History</h3>
            <p className="text-sm text-gray-500">{agentName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

          {loading && <p className="text-gray-500 text-sm">Loading history...</p>}

          {!loading && logs.length === 0 && !error && (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No status history yet</p>
            </div>
          )}

          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl border border-saas-border">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${log.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-saas-text-primary">
                    {log.status === 'ACTIVE' ? 'Active' : 'Offline'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {log.source === 'MANUAL' ? 'manual' : 'automatic'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {format(new Date(log.startedAt), 'dd MMM yyyy, HH:mm')}
                  {log.endedAt ? ` – ${format(new Date(log.endedAt), 'HH:mm')}` : ' – now'}
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-600 flex-shrink-0">
                {formatDuration(log.startedAt, log.endedAt)}
              </span>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-saas-border">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-saas-border disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-saas-border disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
