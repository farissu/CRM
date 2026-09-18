'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, CheckCircle2, Clock, Timer, ArrowUpDown } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { getRoleBadgeColor, getRoleLabel } from '../settings/settingsUtils';
import type { AgentPerformanceStats, AgentPerformanceRow } from '@/types';

const EMPTY_STATS: AgentPerformanceStats = {
  summary: { totalAgents: 0, activeNow: 0, messagesSentToday: 0, messagesSentTodayByBot: 0, messagesSentTodayByHuman: 0, resolvedToday: 0, avgResponseMinutes: null, totalActiveHoursToday: 0 },
  agents: [],
};

type SortKey = 'name' | 'totalConversations' | 'messagesSentToday' | 'avgResponseMinutes' | 'activeMinutesToday';

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '–';
  if (minutes < 1) return '<1m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;
}

function StatCard({ icon, label, value, subtitle, color }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; color: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-saas-text-primary leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function AgentOverviewPanel() {
  const [stats, setStats] = useState<AgentPerformanceStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'totalConversations', dir: 'desc' });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dashboardApi.getAgentStats();
      setStats(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load agent dashboard');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const sortedAgents = useMemo(() => {
    const dirMultiplier = sort.dir === 'asc' ? 1 : -1;
    return [...stats.agents].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dirMultiplier;
      const aVal = a[sort.key] ?? -1;
      const bVal = b[sort.key] ?? -1;
      return (aVal - bVal) * dirMultiplier;
    });
  }, [stats.agents, sort]);

  const messagesChartData = useMemo(
    () => [...stats.agents].sort((a, b) => b.messagesSentToday - a.messagesSentToday).slice(0, 8).map((a) => ({ name: a.name, 'Pesan Hari Ini': a.messagesSentToday })),
    [stats.agents]
  );

  const workloadChartData = useMemo(
    () =>
      [...stats.agents]
        .sort((a, b) => b.totalConversations - a.totalConversations)
        .slice(0, 8)
        .map((a) => ({ name: a.name, Open: a.openConversations, Resolved: a.resolvedConversations })),
    [stats.agents]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">{error}</div>
      )}

      {loading && <p className="text-gray-500 text-sm">Memuat data performa agent...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Active Sekarang"
          value={`${stats.summary.activeNow}/${stats.summary.totalAgents}`}
          subtitle="agent online"
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <StatCard
          icon={<MessageSquare className="w-6 h-6" />}
          label="Pesan Terkirim"
          value={stats.summary.messagesSentToday.toLocaleString('id-ID')}
          subtitle={`${stats.summary.messagesSentTodayByHuman.toLocaleString('id-ID')} agent · ${stats.summary.messagesSentTodayByBot.toLocaleString('id-ID')} AI`}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Percakapan Selesai"
          value={stats.summary.resolvedToday.toLocaleString('id-ID')}
          subtitle="hari ini"
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Rata-rata Respon"
          value={formatMinutes(stats.summary.avgResponseMinutes)}
          subtitle="30 hari terakhir"
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
        <StatCard
          icon={<Timer className="w-6 h-6" />}
          label="Total Jam Aktif"
          value={`${stats.summary.totalActiveHoursToday}j`}
          subtitle="hari ini, semua agent"
          color="bg-gradient-to-br from-teal-500 to-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl shadow-soft p-6">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">Pesan Terkirim per Agent (Hari Ini)</h3>
          {messagesChartData.some((d) => d['Pesan Hari Ini'] > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={messagesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6B7280" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="Pesan Hari Ini" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">Belum ada pesan hari ini</p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-soft p-6">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">Beban Kerja Percakapan</h3>
          {workloadChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workloadChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6B7280" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="Open" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Resolved" stackId="a" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">Belum ada percakapan yang ditugaskan</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-saas-border">
          <h3 className="text-lg font-bold text-saas-text-primary">Detail Performa Agent</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-saas-border">
                <SortableHeader label="Agent" sortKey="name" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Open</th>
                <th className="px-4 py-3 font-semibold text-right">Selesai</th>
                <SortableHeader label="Total" sortKey="totalConversations" sort={sort} onSort={toggleSort} align="right" />
                <SortableHeader label="Pesan Hari Ini" sortKey="messagesSentToday" sort={sort} onSort={toggleSort} align="right" />
                <SortableHeader label="Rata Respon" sortKey="avgResponseMinutes" sort={sort} onSort={toggleSort} align="right" />
                <SortableHeader label="Aktif Hari Ini" sortKey="activeMinutesToday" sort={sort} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((row) => (
                <AgentRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
        {!loading && stats.agents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Belum ada data agent</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableHeader({
  label, sortKey, sort, onSort, align = 'left',
}: { label: string; sortKey: SortKey; sort: { key: SortKey; dir: 'asc' | 'desc' }; onSort: (key: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-4 py-3 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button onClick={() => onSort(sortKey)} className={`flex items-center gap-1 hover:text-saas-text-primary transition-colors ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-saas-text-primary' : ''}`}>
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}

function AgentRow({ row }: { row: AgentPerformanceRow }) {
  return (
    <tr className="border-b border-saas-border last:border-0 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{row.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-saas-text-primary truncate">{row.name}</p>
            <div className="flex items-center gap-1">
              <span className={`${getRoleBadgeColor(row.role)} text-white px-2 py-0.5 rounded-md text-[10px] font-bold`}>{getRoleLabel(row.role)}</span>
              {row.isBot && (
                <span className="bg-gradient-to-br from-teal-500 to-teal-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">AI</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${row.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {row.status === 'ACTIVE' ? 'Active' : 'Offline'}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{row.openConversations}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.resolvedConversations}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">{row.totalConversations}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.messagesSentToday}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(row.avgResponseMinutes)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(row.activeMinutesToday)}</td>
    </tr>
  );
}
