'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardCard, { EmptyState } from './DashboardCard';
import { formatDayLabel, formatFullDay, formatNumber } from './dashboardFormat';
import type { DashboardStats } from '@/types';

const CHART_HEIGHT = 280;
const SERIES = [
  { key: 'inbound', label: 'Pesan Masuk', color: '#3B82F6' },
  { key: 'outbound', label: 'Pesan Terkirim', color: '#10B981' },
] as const;

interface MessageTrendChartProps {
  data: DashboardStats['messageTrend'];
  periodLabel: string;
}

export default function MessageTrendChart({ data, periodLabel }: MessageTrendChartProps) {
  const hasData = data.some((d) => d.inbound > 0 || d.outbound > 0);

  return (
    <DashboardCard
      title="Grafik Pesan"
      subtitle={`Tren pesan masuk dan pesan terkirim · ${periodLabel}`}
      headerRight={
        <div className="hidden sm:flex items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayLabel}
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              labelFormatter={(label) => formatFullDay(String(label))}
              formatter={(value, name) => [formatNumber(Number(value)), SERIES.find((s) => s.key === name)?.label ?? name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #E1E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#trend-${s.key})`}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="Belum ada pesan pada periode ini" heightClassName="h-[280px]" />
      )}
    </DashboardCard>
  );
}
