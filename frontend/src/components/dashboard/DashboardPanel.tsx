'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MessageSquare, Clock, CheckCircle, TrendingUp, Users, Activity, Tag } from 'lucide-react';
import { conversationApi, messageApi, labelApi } from '@/lib/api';
import type { Conversation, Message, Label } from '@/types';

interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  totalContacts: number;
  newContactsToday: number;
  todayMessages: number;
}

export default function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    openConversations: 0,
    resolvedConversations: 0,
    totalMessages: 0,
    totalContacts: 0,
    newContactsToday: 0,
    todayMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelDistribution, setLabelDistribution] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [messageVolumeData, setMessageVolumeData] = useState<Array<{ day: string; messages: number }>>([]);
  const [peakHoursData, setPeakHoursData] = useState<Array<{ hour: string; messages: number }>>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load conversations and labels
      const [convResponse, labelsResponse] = await Promise.all([
        conversationApi.getConversations({ limit: 1000 }),
        labelApi.getLabels()
      ]);
      setConversations(convResponse.conversations);
      setLabels(labelsResponse.labels);

      // Calculate stats
      const openConvs = convResponse.conversations.filter(c => c.status === 'open').length;
      const resolvedConvs = convResponse.conversations.filter(c => c.status === 'resolved').length;
      
      // Load messages from all conversations
      let totalMessages = 0;
      let todayMessages = 0;
      const today = new Date().toDateString();
      const allMessages: Message[] = [];
      
      for (const conv of convResponse.conversations.slice(0, 10)) {
        try {
          const msgResponse = await messageApi.getMessages(conv.id, { limit: 100 });
          totalMessages += msgResponse.messages.length;
          todayMessages += msgResponse.messages.filter(m => 
            new Date(m.timestamp).toDateString() === today
          ).length;
          allMessages.push(...msgResponse.messages);
        } catch (err) {
          console.error('Error loading messages for conversation:', err);
        }
      }

      // Calculate message volume for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
      });

      const volumeData = last7Days.map(date => {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toDateString();
        const count = allMessages.filter(m => 
          new Date(m.timestamp).toDateString() === dateStr
        ).length;
        return { day: dayName, messages: count };
      });
      setMessageVolumeData(volumeData);

      // Calculate peak hours activity (incoming messages per time slot)
      const hourSlots = [
        { hour: '00:00', start: 0, end: 4 },
        { hour: '04:00', start: 4, end: 8 },
        { hour: '08:00', start: 8, end: 12 },
        { hour: '12:00', start: 12, end: 16 },
        { hour: '16:00', start: 16, end: 20 },
        { hour: '20:00', start: 20, end: 24 },
      ];

      const peakData = hourSlots.map(slot => {
        const slotMessages = allMessages.filter(m => {
          const hour = new Date(m.timestamp).getHours();
          return hour >= slot.start && hour < slot.end && m.direction === 'inbound';
        });
        return { hour: slot.hour, messages: slotMessages.length };
      });
      setPeakHoursData(peakData);

      // Calculate contact growth
      const uniqueContacts = new Set(convResponse.conversations.map(c => c.contactId));
      const todayContacts = convResponse.conversations.filter(c => {
        const createdDate = new Date(c.createdAt).toDateString();
        return createdDate === today;
      });
      const uniqueTodayContacts = new Set(todayContacts.map(c => c.contactId));

      // Calculate label distribution from contact_labels (via _count)
      const labelDistData = labelsResponse.labels
        .map(label => ({
          name: label.name,
          value: label._count?.contacts || 0,
          color: label.color
        }))
        .filter(item => item.value > 0);
      
      setLabelDistribution(labelDistData);

      setStats({
        totalConversations: convResponse.conversations.length,
        openConversations: openConvs,
        resolvedConversations: resolvedConvs,
        totalMessages: totalMessages,
        totalContacts: uniqueContacts.size,
        newContactsToday: uniqueTodayContacts.size,
        todayMessages: todayMessages,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const conversationStatusData = [
    { name: 'Open', value: stats.openConversations, color: '#3B82F6' },
    { name: 'Resolved', value: stats.resolvedConversations, color: '#10B981' },
  ];

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
      <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-8 py-6 shadow-soft">
        <h1 className="text-3xl font-bold leading-none">Dashboard</h1>
        <p className="text-sm text-white/80 font-medium mt-1">Business insights and analytics</p>
      </div>

      <div className="p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            icon={<MessageSquare className="w-8 h-8" />}
            title="Total Conversations"
            value={stats.totalConversations.toString()}
            subtitle={`${stats.openConversations} open, ${stats.resolvedConversations} resolved`}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            icon={<Activity className="w-8 h-8" />}
            title="Total Messages"
            value={stats.totalMessages.toString()}
            subtitle={`${stats.todayMessages} messages today`}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            icon={<Users className="w-8 h-8" />}
            title="Contact Growth"
            value={stats.totalContacts.toString()}
            subtitle={`${stats.newContactsToday} new contacts today`}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Volume Chart */}
          <div className="bg-white rounded-3xl shadow-soft p-6">
            <h3 className="text-xl font-bold text-saas-text-primary mb-4">Message Volume (Last 7 Days)</h3>
            {messageVolumeData.some(d => d.messages > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={messageVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="day" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={conversationStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
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
            {labelDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={labelDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {labelDistribution.map((entry, index) => (
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
            {peakHoursData.some(d => d.messages > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" label={{ value: 'Messages', angle: -90, position: 'insideLeft' }} />
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

        {/* Recent Activity */}
        <div className="bg-white rounded-3xl shadow-soft p-6">
          <h3 className="text-xl font-bold text-saas-text-primary mb-4">Recent Conversations</h3>
          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.slice(0, 5).map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-4 bg-saas-bg rounded-2xl hover:shadow-soft-sm transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      conv.status === 'open' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <Users className={`w-6 h-6 ${
                        conv.status === 'open' ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-saas-text-primary">
                        {conv.contact?.name || conv.contact?.phoneNumber || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 truncate max-w-md">
                        {conv.lastMessageText || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      conv.status === 'open' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {conv.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {conv.unreadCount > 0 && `${conv.unreadCount} unread`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">No conversations yet</p>
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
