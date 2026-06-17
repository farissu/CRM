import React, { useState, useEffect } from 'react';
import { Plus, X, Users, Building2, Mail, Phone } from 'lucide-react';
import type { Agent, Company, Role } from '@/types';
import { agentApi, companyApi } from '@/lib/api';
import { formatPhoneNumber, getRoleBadgeColor, getRoleLabel } from '../settingsUtils';

interface AgentsTabProps {
  agent?: Agent;
}

const EMPTY_AGENT_FORM = { name: '', email: '', password: '', phone: '', role: 'AGENT' as Role, companyId: '' };

export default function AgentsTab({ agent }: AgentsTabProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState(EMPTY_AGENT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([loadAgents(), loadCompanies()]);
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

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAllCompanies();
      setCompanies(response.companies as Company[]);
    } catch {
      // non-critical, dropdown will be empty
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError('Name, email, and password are required');
      return;
    }
    if (!formData.companyId) { setError('Company is required'); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await agentApi.createAgent({ ...formData, phone: formatPhoneNumber(formData.phone) });
      setAgents([response.agent as Agent, ...agents]);
      setFormData(EMPTY_AGENT_FORM);
      setIsAdding(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create agent';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) return;
    try {
      setLoading(true);
      setError(null);
      await agentApi.deleteAgent(agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete agent';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-saas-text-primary">Agents</h2>
          <p className="text-gray-600 mt-1">
            {agent?.role === 'SUPER_ADMIN' ? 'Manage all agents and their access' : 'View team members in your company'}
          </p>
        </div>
        {!isAdding && agent?.role === 'SUPER_ADMIN' && (
          <button onClick={() => setIsAdding(true)} className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-soft-sm flex items-center gap-2">
            <Plus className="w-5 h-5" />Add Agent
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isAdding && agent?.role === 'SUPER_ADMIN' && (
        <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">New Agent</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@company.com" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 6 characters" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} placeholder="081299998888" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })} className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium">
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company *</label>
                <select value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium">
                  <option value="">Select Company</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => void handleCreate()} disabled={loading} className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50">
                {loading ? 'Creating...' : 'Create Agent'}
              </button>
              <button onClick={() => { setIsAdding(false); setFormData(EMPTY_AGENT_FORM); }} className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {agents.map((agentItem) => (
          <div key={agentItem.id} className="bg-white rounded-2xl p-6 border border-saas-border hover:shadow-soft transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center shadow-soft-sm">
                  <span className="text-white font-bold text-xl">{agentItem.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-saas-text-primary">{agentItem.name}</h3>
                    <span className={`${getRoleBadgeColor(agentItem.role)} text-white px-3 py-1 rounded-lg text-xs font-bold shadow-soft-sm`}>{getRoleLabel(agentItem.role)}</span>
                    {agentItem.company && (
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{agentItem.company.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{agentItem.email}</span>
                    {agentItem.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{formatPhoneNumber(agentItem.phone)}</span>}
                  </div>
                </div>
              </div>
              {agent?.role === 'SUPER_ADMIN' && (
                <button onClick={() => void handleDelete(agentItem.id)} disabled={agentItem.id === agent?.id} className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed" title={agentItem.id === agent?.id ? 'Cannot delete yourself' : 'Delete agent'}>
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No agents yet</p>
          <p className="text-gray-500 text-sm mt-1">Add your first agent to get started</p>
        </div>
      )}
    </div>
  );
}
