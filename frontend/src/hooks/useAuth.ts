'use client';

import { useState, useEffect } from 'react';
import { authApi } from '@/lib/auth';
import { socketClient } from '@/lib/socket';
import type { Agent } from '@/types';

interface UseAuthReturn {
  isAuthenticated: boolean;
  agent: Agent | null;
  agentId: string;
  agentName: string;
  checkingAuth: boolean;
  handleLoginSuccess: (id: string, name: string) => void;
  handleLogout: () => Promise<void>;
  refreshAgentData: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setCheckingAuth(false); return; }
      try {
        const response = await authApi.me();
        setIsAuthenticated(true);
        setAgent(response.agent);
        setAgentId(response.agent.id);
        setAgentName(response.agent.name);
      } catch {
        authApi.logout();
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const refreshAgentData = async () => {
    try {
      const response = await authApi.me();
      setAgent(response.agent);
      setAgentId(response.agent.id);
      setAgentName(response.agent.name);
    } catch {
      // silently fail — agent data stays stale
    }
  };

  const handleLoginSuccess = (id: string, name: string) => {
    setIsAuthenticated(true);
    setAgentId(id);
    setAgentName(name);
    const agentData = authApi.getAgent();
    if (agentData) setAgent(agentData);
  };

  const handleLogout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
    setAgent(null);
    setAgentId('');
    setAgentName('');
    socketClient.disconnect();
  };

  return { isAuthenticated, agent, agentId, agentName, checkingAuth, handleLoginSuccess, handleLogout, refreshAgentData };
}
