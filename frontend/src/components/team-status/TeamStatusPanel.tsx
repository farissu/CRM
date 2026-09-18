'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Users, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { agentApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { getRoleBadgeColor, getRoleLabel } from '../settings/settingsUtils';
import StatusHistoryModal from './StatusHistoryModal';
import AgentOverviewPanel from './AgentOverviewPanel';
import type { Agent, AgentStatusSummary } from '@/types';

function mergeStatus(agents: Agent[], update: AgentStatusSummary): Agent[] {
  return agents.map((a) => (a.id === update.id ? { ...a, status: update.status, statusUpdatedAt: update.statusUpdatedAt } : a));
}

export default function TeamStatusPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyAgent, setHistoryAgent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    const handleUpdate = (update: AgentStatusSummary) => setAgents((prev) => mergeStatus(prev, update));
    socketClient.onAgentStatusUpdated(handleUpdate);
    return () => socketClient.offAgentStatusUpdated(handleUpdate);
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentApi.getAllAgents();
      setAgents(response.agents as Agent[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="flex-1 flex flex-col bg-saas-bg overflow-y-auto">
      <div className="bg-saas-secondary-blue text-white px-8 py-6 shadow-soft">
        <h1 className="text-3xl font-bold leading-none">Agent Dashboard</h1>
        <p className="text-sm text-white/80 font-medium mt-1">{activeCount} of {agents.length} agents active</p>
      </div>

      <div className="p-8 space-y-8">
        <AgentOverviewPanel />

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-saas-text-primary">Status Live</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">{error}</div>
          )}

          {loading && <p className="text-gray-500 text-sm">Loading agent data...</p>}

          <div className="space-y-3">
            {sortedAgents.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 border border-saas-border hover:shadow-soft transition-all duration-200 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center shadow-soft-sm">
                      <span className="text-white font-bold text-lg">{item.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                        item.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-saas-text-primary truncate">{item.name}</h3>
                      <span className={`${getRoleBadgeColor(item.role)} text-white px-2.5 py-0.5 rounded-lg text-xs font-bold flex-shrink-0`}>
                        {getRoleLabel(item.role)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.status === 'ACTIVE' ? 'Active' : 'Offline'}
                      {item.statusUpdatedAt && (
                        <> &middot; since {formatDistanceToNow(new Date(item.statusUpdatedAt), { addSuffix: true })}</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryAgent({ id: item.id, name: item.name })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-saas-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <History className="w-4 h-4" />
                  History
                </button>
              </div>
            ))}
          </div>

          {!loading && agents.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No agents yet</p>
            </div>
          )}
        </div>
      </div>

      {historyAgent && (
        <StatusHistoryModal agentId={historyAgent.id} agentName={historyAgent.name} onClose={() => setHistoryAgent(null)} />
      )}
    </div>
  );
}
