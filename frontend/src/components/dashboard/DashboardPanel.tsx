'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Upload, Download, Users, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { conversationApi, labelApi, contactApi, dashboardApi } from '@/lib/api';
import type { Conversation, DashboardStats, Label } from '@/types';

interface ContactRow {
  id: string;
  name: string;
  phoneNumber: string;
  labels: Label[];
  lastMessageAt: string;
}

const MAX_VISIBLE_CONTACTS = 8;

const EMPTY_STATS: DashboardStats = {
  totalConversations: 0,
  openConversations: 0,
  resolvedConversations: 0,
  totalMessages: 0,
  todayMessages: 0,
  totalContacts: 0,
  newContactsToday: 0,
  messageVolume: [],
  peakHours: [],
  labelDistribution: [],
};

export default function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [exportLabelId, setExportLabelId] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // One row per contact (a contact can have several conversations over time), keeping
  // each contact's most recent conversation for the "last activity" column, then
  // filtered client-side by the same label the Download Contacts button will export.
  const contactRows = useMemo<ContactRow[]>(() => {
    const byContact = new Map<string, ContactRow>();
    for (const conv of conversations) {
      const contact = conv.contact;
      if (!contact) continue;
      const existing = byContact.get(contact.id);
      if (!existing || new Date(conv.lastMessageAt) > new Date(existing.lastMessageAt)) {
        byContact.set(contact.id, {
          id: contact.id,
          name: contact.name || contact.phoneNumber,
          phoneNumber: contact.phoneNumber,
          labels: contact.labels || [],
          lastMessageAt: conv.lastMessageAt,
        });
      }
    }

    const rows = Array.from(byContact.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    if (!exportLabelId) return rows;
    if (exportLabelId === 'UNLABELED') return rows.filter(row => row.labels.length === 0);
    return rows.filter(row => row.labels.some(label => label.id === exportLabelId));
  }, [conversations, exportLabelId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Accurate totals come from the server (one batched query), not from a capped
      // client-side slice. Conversations are still fetched (paginated) purely to power
      // the recent-contacts list below.
      const [statsResponse, convResponse, labelsResponse] = await Promise.all([
        dashboardApi.getStats(),
        conversationApi.getConversations({ limit: 100 }),
        labelApi.getLabels(),
      ]);

      setStats(statsResponse);
      setConversations(convResponse.conversations);
      setLabels(labelsResponse.labels);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadContacts = async () => {
    try {
      setExporting(true);
      const blob = await contactApi.exportContacts(exportLabelId || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export contacts:', error);
    } finally {
      setExporting(false);
    }
  };

  // Prepare chart data
  const conversationStatusData = [
    { name: 'Open', value: stats.openConversations, color: '#3B82F6' },
    { name: 'Resolved', value: stats.resolvedConversations, color: '#10B981' },
  ];
  const hasResolved = stats.resolvedConversations > 0;
  const resolvedRate = stats.totalConversations > 0
    ? Math.round((stats.resolvedConversations / stats.totalConversations) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-saas-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-saas-primary-blue border-t-transparent mx-auto mb-4"></div>
          <p className="text-saas-text-primary font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-saas-bg overflow-y-auto">
      {/* Header */}
      <div className="bg-saas-secondary-blue text-white px-8 py-6 shadow-soft">
        <h1 className="text-3xl font-bold leading-none">Dashboard</h1>
        <p className="text-sm text-white/80 font-medium mt-1">Business insights and analytics</p>
      </div>

      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            icon={<MessageSquare className="w-8 h-8" />}
            title="Total Conversations"
            value={stats.totalConversations.toLocaleString('id-ID')}
            subtitle={`${stats.openConversations.toLocaleString('id-ID')} open · ${stats.resolvedConversations.toLocaleString('id-ID')} resolved · ${resolvedRate}% resolved`}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            icon={<Upload className="w-8 h-8" />}
            title="Total Messages"
            value={stats.totalMessages.toLocaleString('id-ID')}
            subtitle={`${stats.todayMessages.toLocaleString('id-ID')} messages today`}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            icon={<Users className="w-8 h-8" />}
            title="Contact Growth"
            value={stats.totalContacts.toLocaleString('id-ID')}
            subtitle={`${stats.newContactsToday.toLocaleString('id-ID')} new contacts today`}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Volume Chart */}
          <div className="bg-white rounded-3xl shadow-soft p-6">
            <h3 className="text-xl font-bold text-saas-text-primary mb-4">Message Volume (Last 7 Days)</h3>
            {stats.messageVolume.some(d => d.messages > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.messageVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="day" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="messages" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-gray-500">No messages in the last 7 days</p>
              </div>
            )}
          </div>

          {/* Conversation Status Chart */}
          <div className="bg-white rounded-3xl shadow-soft p-6">
            <h3 className="text-xl font-bold text-saas-text-primary mb-4">Conversation Status</h3>
            {stats.totalConversations > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={conversationStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${Number(value).toLocaleString('id-ID')}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {conversationStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {hasResolved ? (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    {resolvedRate}% of conversations resolved
                  </p>
                ) : (
                  <p className="text-center text-sm text-gray-400 mt-2">
                    No resolved conversations yet
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-gray-500">No conversations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 2 - Label Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Label Distribution Chart */}
          <div className="bg-white rounded-3xl shadow-soft p-6">
            <h3 className="text-xl font-bold text-saas-text-primary mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-saas-primary-blue" />
              Label Distribution
            </h3>
            {stats.labelDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.labelDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props) => `${props.name ?? ''}: ${Number(props.value).toLocaleString('id-ID')} (${(((props.percent as number) ?? 0) * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.labelDistribution.map((entry, index) => (
                      <Cell key={`label-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-gray-500">No labels assigned to contacts yet</p>
              </div>
            )}
          </div>

          {/* Peak Hours Activity */}
          <div className="bg-white rounded-3xl shadow-soft p-6">
            <h3 className="text-xl font-bold text-saas-text-primary mb-4">Peak Hours Activity</h3>
            {stats.peakHours.some(d => d.messages > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" allowDecimals={false} label={{ value: 'Messages', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="messages" fill="#10B981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-gray-500">No incoming messages to show peak hours</p>
              </div>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-3xl shadow-soft p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-xl font-bold text-saas-text-primary">Recent Contacts</h3>
            <div className="flex items-center gap-2">
              <select
                value={exportLabelId}
                onChange={(e) => setExportLabelId(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-saas-text-primary focus:outline-none focus:ring-2 focus:ring-saas-primary-blue"
              >
                <option value="">All Contacts</option>
                <option value="UNLABELED">Unlabeled</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>{label.name}</option>
                ))}
              </select>
              <button
                onClick={handleDownloadContacts}
                disabled={exporting}
                className="flex items-center gap-2 text-sm font-semibold bg-saas-primary-blue text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Download Contacts'}
              </button>
            </div>
          </div>
          {contactRows.length > 0 ? (
            <>
              <div className="space-y-2">
                {contactRows.slice(0, MAX_VISIBLE_CONTACTS).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-4 p-4 bg-saas-bg rounded-2xl hover:shadow-soft-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-saas-text-primary truncate">{row.name}</p>
                        <p className="text-sm text-gray-500">{row.phoneNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[220px] justify-end">
                        {row.labels.length > 0 ? (
                          row.labels.map((label) => (
                            <span
                              key={label.id}
                              className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: `${label.color}20`, color: label.color }}
                            >
                              {label.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">No label</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(row.lastMessageAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {contactRows.length > MAX_VISIBLE_CONTACTS && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  Showing {MAX_VISIBLE_CONTACTS} of {contactRows.length} contacts — use Download Contacts above for the full list.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">No contacts match this filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: string;
}

function StatCard({ icon, title, value, subtitle, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-6 hover:shadow-soft-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 font-semibold mb-2">{title}</p>
          <p className="text-4xl font-bold text-saas-text-primary mb-1">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className={`${color} text-white p-3 rounded-2xl shadow-soft-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
