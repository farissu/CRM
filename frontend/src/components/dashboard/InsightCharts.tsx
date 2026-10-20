'use client';

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardCard, { EmptyState } from './DashboardCard';
import { formatNumber, ratePercent } from './dashboardFormat';
import type { DashboardStats } from '@/types';

const CHART_HEIGHT = 240;
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #E1E8F0', fontSize: 12 };

export function PeakHoursChart({ data, days }: { data: DashboardStats['peakHours']; days: number }) {
  return (
    <DashboardCard title="Jam Sibuk" subtitle={`Pesan masuk per jam, ${days} hari terakhir`}>
      {data.some((d) => d.messages > 0) ? (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Pesan masuk']} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="messages" fill="#6366F1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="Belum ada pesan masuk pada periode ini" heightClassName="h-[240px]" />
      )}
    </DashboardCard>
  );
}

export function LabelDistributionChart({ data }: { data: DashboardStats['labelDistribution'] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardCard title="Distribusi Label" subtitle="Jumlah kontak per label">
      {data.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="100%" stroke="none">
                  {data.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(Number(value))} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-2 max-h-[200px] overflow-y-auto">
            {data.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-saas-text-primary truncate">{entry.name}</span>
                </span>
                <span className="text-gray-500 whitespace-nowrap">
                  {formatNumber(entry.value)} · {Math.round(ratePercent(entry.value, total) ?? 0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState message="Belum ada label yang dipasang ke kontak" heightClassName="h-[180px]" />
      )}
    </DashboardCard>
  );
}
