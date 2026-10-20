import { ArrowRight, MessageSquareDot } from 'lucide-react';
import { formatNumber } from './dashboardFormat';

interface AwaitingReplyCardProps {
  total: number;
  unassigned: number;
  onOpenInbox?: () => void;
}

export default function AwaitingReplyCard({ total, unassigned, onOpenInbox }: AwaitingReplyCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-saas-border shadow-soft-sm p-5 flex flex-col">
      <h3 className="text-base font-bold text-saas-text-primary mb-4">Percakapan Belum Dibalas</h3>
      <div className="flex items-center gap-4 flex-1">
        <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
          <MessageSquareDot className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-bold text-saas-text-primary leading-none">{formatNumber(total)}</p>
          <p className="text-xs text-gray-500 mt-1.5">Pelanggan menunggu balasan</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-saas-border">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-saas-text-primary">{formatNumber(unassigned)}</span> belum di-assign agent
        </p>
        {onOpenInbox && (
          <button
            type="button"
            onClick={onOpenInbox}
            aria-label="Buka inbox"
            className="w-8 h-8 rounded-lg border border-saas-border flex items-center justify-center text-gray-500 hover:bg-saas-bg"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}
