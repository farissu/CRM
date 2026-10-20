'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, Timer, Users } from 'lucide-react';
import { conversationApi, dashboardApi, labelApi } from '@/lib/api';
import type { Conversation, DashboardRangeDays, DashboardStats, Label } from '@/types';
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

const RANGE_OPTIONS: Array<{ days: DashboardRangeDays; label: string }> = [
  { days: 7, label: '7 Hari Terakhir' },
  { days: 30, label: '30 Hari Terakhir' },
];
// Enough recent conversations to fill the table and the recent-contacts list.
const RECENT_CONVERSATION_LIMIT = 100;

interface DashboardPanelProps {
  onNavigate?: (tab: DashboardLinkTab) => void;
}

export default function DashboardPanel({ onNavigate }: DashboardPanelProps) {
  const [days, setDays] = useState<DashboardRangeDays>(7);
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
          dashboardApi.getStats(days),
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
  }, [days, reloadKey]);

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
    <div className="flex-1 flex flex-col bg-saas-bg overflow-y-auto">
      <header className="bg-saas-secondary-blue text-white px-4 md:px-8 py-5 shadow-soft flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold leading-none">Dashboard</h1>
          <p className="text-sm text-white/80 font-medium mt-1">Ringkasan performa layanan pelanggan</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as DashboardRangeDays)}
            aria-label="Periode"
            className="text-sm font-semibold bg-white text-saas-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
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
            <MessageTrendChart data={stats.messageTrend} days={stats.range.days} />
          </div>
          <ChannelDonut data={stats.channelDistribution} days={stats.range.days} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 min-w-0">
            <RecentConversationsTable
              conversations={conversations}
              onViewAll={onNavigate ? () => onNavigate('conversations') : undefined}
            />
          </div>
          <div className="xl:col-span-5 space-y-5 min-w-0">
            <ChannelAlerts alerts={stats.alerts} days={stats.range.days} onNavigate={onNavigate} />
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
          <PeakHoursChart data={stats.peakHours} days={stats.range.days} />
          <LabelDistributionChart data={stats.labelDistribution} />
        </div>

        <RecentContacts
          conversations={conversations}
          labels={labels}
          totalContacts={stats.contacts.total}
          newContacts={stats.contacts.newInRange}
          days={stats.range.days}
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
        subtitle="Waktu agent membalas pesan pelanggan"
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
            ? `${formatNumber(sla.met)} dari ${formatNumber(sla.total)} pesan dibalas tepat waktu`
            : 'Belum ada pesan yang bisa dinilai'
        }
        trend={{ change: slaRate !== null && prevSlaRate !== null ? slaRate - prevSlaRate : null, unit: ' poin' }}
      />
      <KpiCard
        icon={<Users className="w-6 h-6" />}
        iconClassName="bg-emerald-50 text-emerald-600"
        title="Agent Online"
        value={formatNumber(kpis.agents.online)}
        valueSuffix={`/${formatNumber(kpis.agents.total)}`}
        subtitle="Agent yang sedang aktif saat ini"
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
