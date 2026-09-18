import React, { useEffect, useState } from 'react';
import { agentApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { getRoleBadgeColor, getRoleLabel } from '../settings/settingsUtils';
import type { Agent, AgentStatus, AgentStatusSummary } from '@/types';

interface AgentProfileBarProps {
  agent: Agent;
}

export default function AgentProfileBar({ agent }: AgentProfileBarProps) {
  const [status, setStatus] = useState<AgentStatus>(agent.status ?? 'OFFLINE');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (agent.status) setStatus(agent.status);
  }, [agent.status]);

  useEffect(() => {
    const handleUpdate = (update: AgentStatusSummary) => {
      if (update.id === agent.id) setStatus(update.status);
    };
    socketClient.onAgentStatusUpdated(handleUpdate);
    return () => socketClient.offAgentStatusUpdated(handleUpdate);
  }, [agent.id]);

  const handleToggle = async () => {
    const nextStatus: AgentStatus = status === 'ACTIVE' ? 'OFFLINE' : 'ACTIVE';
    try {
      setToggling(true);
      const response = await agentApi.updateMyStatus(nextStatus);
      setStatus(response.agent.status);
    } catch {
      // Best-effort — the socket broadcast reconciles state if this silently failed.
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="bg-white border-b border-saas-border px-4 py-3 flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center shadow-soft-sm">
          <span className="text-white font-bold">{agent.name.charAt(0).toUpperCase()}</span>
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-saas-text-primary truncate">{agent.name}</p>
          <span className={`${getRoleBadgeColor(agent.role)} text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0`}>
            {getRoleLabel(agent.role)}
          </span>
        </div>
        <p className="text-xs text-gray-500">{status === 'ACTIVE' ? 'Active' : 'Offline'}</p>
      </div>

      <button
        onClick={() => void handleToggle()}
        disabled={toggling}
        role="switch"
        aria-checked={status === 'ACTIVE'}
        title={status === 'ACTIVE' ? 'Set Offline' : 'Set Active'}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
          status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-soft-sm transition-transform duration-200 ${
            status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
