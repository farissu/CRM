import React, { useState, useEffect } from 'react';
import { Zap, Shield, Save, X } from 'lucide-react';
import type { Agent, Company } from '@/types';
import { companyApi } from '@/lib/api';

interface ApiIntegrationTabProps {
  agent?: Agent;
}

export default function ApiIntegrationTab({ agent }: ApiIntegrationTabProps) {
  const [webhookData, setWebhookData] = useState({ webhookUrl: '', webhookCallbackUrl: '' });
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSuccess, setWebhookSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadWebhookData();
  }, [agent?.companyId]);

  const loadWebhookData = async () => {
    if (!agent?.companyId) return;
    try {
      setError(null);
      const response = await companyApi.getAllCompanies();
      const userCompany = (response.companies as Company[]).find(c => c.id === agent.companyId);
      if (userCompany) {
        setWebhookData({ webhookUrl: userCompany.webhookUrl || '', webhookCallbackUrl: userCompany.webhookCallbackUrl || '' });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook configuration');
    }
  };

  const handleSaveWebhook = async () => {
    if (!agent?.companyId) { setError('No company associated with your account'); return; }
    try {
      setWebhookLoading(true);
      setError(null);
      setWebhookSuccess(false);
      await companyApi.updateWebhook(agent.companyId, webhookData);
      setWebhookSuccess(true);
      setTimeout(() => setWebhookSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save webhook configuration';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setWebhookLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-saas-text-primary mb-2">API Integration</h2>
      <p className="text-gray-600 mb-6">Configure webhook URLs for WhatsApp Business API or other messaging platforms</p>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {webhookSuccess && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Save className="w-5 h-5 text-green-500" />
          <p className="text-green-800 font-semibold">Webhook configuration saved successfully!</p>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-saas-border space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />Webhook URL (Incoming Messages)
          </label>
          <p className="text-xs text-gray-500 mb-2">This URL will receive incoming messages from your customers via WhatsApp or other platforms</p>
          <input type="url" value={webhookData.webhookUrl} onChange={(e) => setWebhookData({ ...webhookData, webhookUrl: e.target.value })} className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" placeholder="https://your-domain.com/api/webhook/incoming" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />Webhook Callback URL (Status Updates)
          </label>
          <p className="text-xs text-gray-500 mb-2">This URL will receive status updates (sent, delivered, read) for messages you send</p>
          <input type="url" value={webhookData.webhookCallbackUrl} onChange={(e) => setWebhookData({ ...webhookData, webhookCallbackUrl: e.target.value })} className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" placeholder="https://your-domain.com/api/webhook/status" />
        </div>
        <button onClick={() => void handleSaveWebhook()} disabled={webhookLoading} className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />{webhookLoading ? 'Saving...' : 'Save Configuration'}
        </button>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Shield className="w-4 h-4" />How it works</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Incoming Webhook:</strong> Receives POST requests when customers send messages</li>
            <li><strong>Status Webhook:</strong> Receives POST requests for message delivery status updates</li>
            <li>Make sure your webhook endpoints can accept POST requests with JSON payloads</li>
            <li>Use HTTPS for secure communication</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
