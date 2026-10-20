import DashboardCard, { EmptyState } from './DashboardCard';
import { formatDuration, formatNumber, initials } from './dashboardFormat';
import type { DashboardTopAgent } from '@/types';

const RANK_STYLES = ['bg-amber-100 text-amber-700', 'bg-slate-100 text-slate-600', 'bg-orange-100 text-orange-700'];
const DEFAULT_RANK_STYLE = 'bg-gray-100 text-gray-500';

interface TopAgentsProps {
  agents: DashboardTopAgent[];
}

export default function TopAgents({ agents }: TopAgentsProps) {
  const leaderResolved = agents[0]?.resolved ?? 0;

  return (
    <DashboardCard title="Top Agent" subtitle="Berdasarkan percakapan selesai">
      {agents.length === 0 ? (
        <EmptyState message="Belum ada percakapan yang diselesaikan" heightClassName="h-32" />
      ) : (
        <ol className="space-y-3">
          {agents.map((agent, index) => (
            <li key={agent.id} className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  RANK_STYLES[index] ?? DEFAULT_RANK_STYLE
                }`}
              >
                {index + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-saas-200 text-saas-800 flex items-center justify-center text-xs font-bold shrink-0">
                {initials(agent.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-saas-text-primary truncate">{agent.name}</p>
                  <p className="text-sm font-bold text-saas-text-primary">{formatNumber(agent.resolved)}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${leaderResolved > 0 ? (agent.resolved / leaderResolved) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap" title="Rata-rata waktu respon">
                    {formatDuration(agent.avgResponseMinutes)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
