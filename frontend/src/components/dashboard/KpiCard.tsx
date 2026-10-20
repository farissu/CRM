import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface KpiTrend {
  /** Change vs the previous period; null hides the badge. */
  change: number | null;
  unit: '%' | ' poin';
  /** Response time: going down is the good direction. */
  isLowerBetter?: boolean;
}

interface KpiCardProps {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  value: string;
  valueSuffix?: string;
  subtitle: string;
  trend?: KpiTrend;
}

export default function KpiCard({ icon, iconClassName, title, value, valueSuffix, subtitle, trend }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-saas-border shadow-soft-sm p-5 flex items-start gap-4 min-w-0">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-600 truncate">{title}</p>
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mt-1">
          <p className="text-2xl font-bold text-saas-text-primary leading-none">
            {value}
            {valueSuffix && <span className="text-sm font-semibold text-gray-400">{valueSuffix}</span>}
          </p>
          {trend && <TrendBadge {...trend} />}
        </div>
        <p className="text-xs text-gray-500 mt-2 truncate" title={subtitle}>{subtitle}</p>
      </div>
    </div>
  );
}

function TrendBadge({ change, unit, isLowerBetter = false }: KpiTrend) {
  if (change === null || !Number.isFinite(change)) return null;
  const rounded = Math.round(Math.abs(change));
  if (rounded === 0) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">0{unit}</span>;
  }
  const isUp = change > 0;
  const isGood = isUp !== isLowerBetter;
  const Arrow = isUp ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
      }`}
      title="Dibanding periode sebelumnya"
    >
      <Arrow className="w-3 h-3" />
      {rounded}
      {unit}
    </span>
  );
}
