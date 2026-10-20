import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, Megaphone } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { formatNumber } from './dashboardFormat';
import type { DashboardAlerts } from '@/types';

/** App tabs the dashboard can link to. */
export type DashboardLinkTab = 'conversations' | 'broadcast';

const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  REJECTED: 'ditolak',
  PAUSED: 'dijeda',
  DISABLED: 'dinonaktifkan',
};

interface AlertItem {
  key: string;
  tone: 'danger' | 'warning';
  icon: ReactNode;
  title: string;
  detail: string;
  actionLabel: string;
  tab: DashboardLinkTab;
}

const TONE_STYLES = {
  danger: { row: 'bg-red-50 border-red-100', icon: 'bg-red-500', title: 'text-red-700', button: 'bg-white text-red-600 border-red-200' },
  warning: { row: 'bg-amber-50 border-amber-100', icon: 'bg-amber-500', title: 'text-amber-700', button: 'bg-white text-amber-700 border-amber-200' },
};

function buildAlerts(alerts: DashboardAlerts, periodLabel: string): AlertItem[] {
  const items: AlertItem[] = [];
  if (alerts.failedMessages > 0) {
    items.push({
      key: 'failed-messages',
      tone: 'danger',
      icon: <AlertTriangle className="w-4 h-4" />,
      title: `${formatNumber(alerts.failedMessages)} pesan gagal terkirim`,
      detail: `Periode ${periodLabel}`,
      actionLabel: 'Lihat Inbox',
      tab: 'conversations',
    });
  }
  if (alerts.problemTemplateCount > 0) {
    const names = alerts.problemTemplates
      .map((t) => `${t.name} (${TEMPLATE_STATUS_LABEL[t.status] ?? t.status.toLowerCase()})`)
      .join(', ');
    const more = alerts.problemTemplateCount - alerts.problemTemplates.length;
    items.push({
      key: 'templates',
      tone: 'warning',
      icon: <FileWarning className="w-4 h-4" />,
      title: `${formatNumber(alerts.problemTemplateCount)} template WhatsApp bermasalah`,
      detail: more > 0 ? `${names}, +${more} lainnya` : names,
      actionLabel: 'Periksa',
      tab: 'broadcast',
    });
  }
  if (alerts.failedBroadcasts > 0) {
    items.push({
      key: 'broadcasts',
      tone: 'danger',
      icon: <Megaphone className="w-4 h-4" />,
      title: `${formatNumber(alerts.failedBroadcasts)} broadcast dengan pengiriman gagal`,
      detail: `${formatNumber(alerts.failedBroadcastRecipients)} penerima gagal · ${periodLabel}`,
      actionLabel: 'Lihat Detail',
      tab: 'broadcast',
    });
  }
  return items;
}

interface ChannelAlertsProps {
  alerts: DashboardAlerts;
  periodLabel: string;
  onNavigate?: (tab: DashboardLinkTab) => void;
}

export default function ChannelAlerts({ alerts, periodLabel, onNavigate }: ChannelAlertsProps) {
  const items = buildAlerts(alerts, periodLabel);

  return (
    <DashboardCard title="Peringatan Saluran & Integrasi">
      {items.length === 0 ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-emerald-50 border-emerald-100">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-700">Semua saluran berjalan normal</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const tone = TONE_STYLES[item.tone];
            return (
              <li key={item.key} className={`flex items-center gap-3 p-3 rounded-xl border ${tone.row}`}>
                <span className={`w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 ${tone.icon}`}>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${tone.title}`}>{item.title}</p>
                  <p className="text-xs text-gray-500 truncate" title={item.detail}>{item.detail}</p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(item.tab)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap hover:opacity-80 ${tone.button}`}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
