'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardCard, { EmptyState } from './DashboardCard';
import ChannelIcon from '@/components/common/ChannelIcon';
import { formatNumber, ratePercent } from './dashboardFormat';
import type { Channel, DashboardStats } from '@/types';

const DONUT_SIZE = 200;
const CHANNEL_META: Record<Channel, { label: string; color: string }> = {
  WHATSAPP: { label: 'WhatsApp', color: '#25D366' },
  INSTAGRAM: { label: 'Instagram', color: '#E1306C' },
};

interface ChannelDonutProps {
  data: DashboardStats['channelDistribution'];
  days: number;
}

export default function ChannelDonut({ data, days }: ChannelDonutProps) {
  const total = data.reduce((sum, d) => sum + d.conversations, 0);
  const slices = data.map((d) => ({ ...d, ...CHANNEL_META[d.channel] }));

  return (
    <DashboardCard title="Kontribusi Saluran Chat" subtitle={`Percakapan aktif ${days} hari terakhir`}>
      {total > 0 ? (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
          <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="conversations"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={slices.filter((s) => s.conversations > 0).length > 1 ? 2 : 0}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.channel} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E1E8F0', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-saas-text-primary">{formatNumber(total)}</span>
              <span className="text-xs text-gray-500">Total Percakapan</span>
            </div>
          </div>
          <ul className="w-full space-y-3">
            {slices.map((s) => (
              <li key={s.channel} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <ChannelIcon channel={s.channel} className="w-6 h-6" />
                  <span className="font-medium text-saas-text-primary truncate">{s.label}</span>
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="font-semibold text-saas-text-primary">
                    {(ratePercent(s.conversations, total) ?? 0).toFixed(1).replace('.', ',')}%
                  </span>
                  <span className="block text-xs text-gray-400">{formatNumber(s.conversations)} percakapan</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState message="Belum ada percakapan pada periode ini" heightClassName="h-[200px]" />
      )}
    </DashboardCard>
  );
}
