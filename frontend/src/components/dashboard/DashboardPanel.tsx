'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, Timer, Users } from 'lucide-react';
import { conversationApi, dashboardApi, labelApi } from '@/lib/api';
import type { Conversation, DashboardDateRange, DashboardStats, Label } from '@/types';
import KpiCard from './KpiCard';
import MessageTrendChart from './MessageTrendChart';
import ChannelDonut from './ChannelDonut';
import RecentConversationsTable from './RecentConversationsTable';
import ChannelAlerts, { DashboardLinkTab } from './ChannelAlerts';
import TopAgents from './TopAgents';
import AwaitingReplyCard from './AwaitingReplyCard';
import { LabelDistributionChart, PeakHoursChart } from './InsightCharts';
import RecentContacts from './RecentContacts';
import { formatDuration, formatNumber, percentChange, ratePercent } from './dashboardFormat';
import DateRangePicker from './DateRangePicker';
import { defaultDateRange, describeRange } from './dashboardDateRange';

// Enough recent conversations to fill the table and the recent-contacts list.
const RECENT_CONVERSATION_LIMIT = 100;

interface DashboardPanelProps {
  onNavigate?: (tab: DashboardLinkTab) => void;
}

export default function DashboardPanel({ onNavigate }: DashboardPanelProps) {
  // Defaults to the last 30 days, matching the backend's default.
  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => defaultDateRange());
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore a slower response for a range the user has already switched away from.
    let isCurrent = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsResponse, convResponse, labelsResponse] = await Promise.all([
          dashboardApi.getStats(dateRange),
          conversationApi.getConversations({ limit: RECENT_CONVERSATION_LIMIT }),
          labelApi.getLabels(),
        ]);
        if (!isCurrent) return;
        setStats(statsResponse);
        setConversations(convResponse.conversations);
        setLabels(labelsResponse.labels);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        if (isCurrent) setError('Gagal memuat data dashboard. Silakan coba lagi.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    load();
    return () => {
      isCurrent = false;
    };
  }, [dateRange, reloadKey]);

  const periodLabel = describeRange(dateRange);

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-saas-bg">
        {error ? (
          <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <div className="text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-saas-primary-blue border-t-transparent mx-auto mb-4"></div>
            <p className="text-saas-text-primary font-semibold">Memuat Dashboard...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    // min-w-0 lets this flex child shrink to the viewport instead of growing to its widest
    // card; overflow-x-hidden is a backstop so nothing can ever add a sideways scrollbar.
    <div className="flex-1 min-w-0 flex flex-col bg-saas-bg overflow-y-auto overflow-x-hidden">
      <header className="bg-saas-secondary-blue text-white px-4 md:px-8 py-5 shadow-soft flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold leading-none">Dashboard</h1>
          <p className="text-sm text-white/80 font-medium mt-1">Ringkasan performa layanan pelanggan</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            aria-label="Muat ulang"
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className={`p-4 md:p-6 space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        <KpiRow stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 min-w-0">
            <MessageTrendChart data={stats.messageTrend} periodLabel={periodLabel} />
          </div>
          <ChannelDonut data={stats.channelDistribution} periodLabel={periodLabel} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 min-w-0">
            <RecentConversationsTable
              conversations={conversations}
              onViewAll={onNavigate ? () => onNavigate('conversations') : undefined}
            />
          </div>
          <div className="xl:col-span-5 space-y-5 min-w-0">
            <ChannelAlerts alerts={stats.alerts} periodLabel={periodLabel} onNavigate={onNavigate} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <TopAgents agents={stats.topAgents} />
              <AwaitingReplyCard
                total={stats.awaitingReply.total}
                unassigned={stats.awaitingReply.unassigned}
                onOpenInbox={onNavigate ? () => onNavigate('conversations') : undefined}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PeakHoursChart data={stats.peakHours} periodLabel={periodLabel} />
          <LabelDistributionChart data={stats.labelDistribution} />
        </div>

        <RecentContacts
          conversations={conversations}
          labels={labels}
          totalContacts={stats.contacts.total}
          newContacts={stats.contacts.newInRange}
          periodLabel={periodLabel}
        />
      </div>
    </div>
  );
}

function KpiRow({ stats }: { stats: DashboardStats }) {
  const { kpis } = stats;
  const { sla } = kpis;
  const slaRate = ratePercent(sla.met, sla.total);
  const prevSlaRate = ratePercent(sla.prevMet, sla.prevTotal);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      <KpiCard
        icon={<Timer className="w-6 h-6" />}
        iconClassName="bg-blue-50 text-blue-600"
        title="Rata-rata Waktu Respon"
        value={formatDuration(kpis.avgResponseMinutes)}
        subtitle="Waktu balas agent"
        trend={{ change: percentChange(kpis.avgResponseMinutes, kpis.prevAvgResponseMinutes), unit: '%', isLowerBetter: true }}
      />
      <KpiCard
        icon={<CheckCircle2 className="w-6 h-6" />}
        iconClassName="bg-violet-50 text-violet-600"
        title="Percakapan Selesai"
        value={formatNumber(kpis.resolvedConversations)}
        subtitle={`dari ${formatNumber(kpis.activeConversations)} percakapan aktif`}
        trend={{ change: percentChange(kpis.resolvedConversations, kpis.prevResolvedConversations), unit: '%' }}
      />
      <KpiCard
        icon={<ShieldCheck className="w-6 h-6" />}
        iconClassName="bg-amber-50 text-amber-600"
        title={`SLA Tercapai (≤ ${sla.targetHours} jam)`}
        value={slaRate === null ? '—' : `${slaRate.toFixed(1).replace('.', ',')}%`}
        subtitle={
          sla.total > 0
            ? `${formatNumber(sla.met)} dari ${formatNumber(sla.total)} tepat waktu`
            : 'Belum ada data'
        }
        trend={{ change: slaRate !== null && prevSlaRate !== null ? slaRate - prevSlaRate : null, unit: ' poin' }}
      />
      <KpiCard
        icon={<Users className="w-6 h-6" />}
        iconClassName="bg-emerald-50 text-emerald-600"
        title="Agent Online"
        value={formatNumber(kpis.agents.online)}
        valueSuffix={`/${formatNumber(kpis.agents.total)}`}
        subtitle="Sedang aktif sekarang"
      />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="font-semibold underline whitespace-nowrap">
        Coba lagi
      </button>
    </div>
  );
}
