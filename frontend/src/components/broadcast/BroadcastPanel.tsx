'use client';

import React, { useState, useEffect } from 'react';
import { Send, Layout, RefreshCw, Plus, Trash2, ChevronRight } from 'lucide-react';
import type { MessageTemplate } from '@/types';
import { templateApi } from '@/lib/api';
import CreateTemplateWizard from './CreateTemplateWizard';
import OutboundMessageList from './OutboundMessageList';
import TemplateDetail from './TemplateDetail';

type SubView = 'wa-broadcast' | 'wa-templates';

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAUSED: 'bg-gray-100 text-gray-600',
  DISABLED: 'bg-gray-100 text-gray-400',
};

const STATUS_DOT: Record<string, string> = {
  APPROVED: 'bg-green-500',
  PENDING: 'bg-yellow-500',
  REJECTED: 'bg-red-500',
  PAUSED: 'bg-gray-400',
  DISABLED: 'bg-gray-300',
};

export default function BroadcastPanel() {
  const [activeView, setActiveView] = useState<SubView>('wa-templates');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (activeView === 'wa-templates') void loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await templateApi.getTemplates();
      setTemplates(res.templates);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await templateApi.syncTemplates();
      setTemplates(res.templates);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      setDeletingId(id);
      await templateApi.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleChangeView = (v: SubView) => {
    setActiveView(v);
    setShowWizard(false);
    setSelectedTemplate(null);
  };

  if (showWizard) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <LeftNav activeView={activeView} onChangeView={handleChangeView} />
        <CreateTemplateWizard
          onBack={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); void loadTemplates(); }}
        />
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <LeftNav activeView={activeView} onChangeView={handleChangeView} />
        <div className="flex-1 overflow-y-auto bg-[#f7f9fc]">
          <TemplateDetail template={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <LeftNav activeView={activeView} onChangeView={handleChangeView} />

      <div className="flex-1 overflow-y-auto bg-[#f7f9fc]">

        {activeView === 'wa-broadcast' && <OutboundMessageList />}

        {activeView === 'wa-templates' && (
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">WhatsApp Templates</h2>
              <p className="text-sm text-gray-500 mt-0.5">Under Broadcast Template Details, you will be able to view your template in your preferred language.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="relative w-64">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search template name"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" /></svg>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => void handleSync()} disabled={syncing} className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-sm hover:opacity-80 disabled:opacity-50 transition-opacity">
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Now
                  </button>
                  <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 bg-[#597ea3] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all">
                    <Plus className="w-4 h-4" />
                    New Template
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading templates...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-500 text-sm mb-4">
                    {search ? 'No templates match your search.' : 'No templates yet. Create your first template to get started.'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowWizard(true)} className="inline-flex items-center gap-2 bg-[#597ea3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all">
                      <Plus className="w-4 h-4" />New Template
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp Account</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Languages</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <button onClick={() => setSelectedTemplate(t)} className="text-[#597ea3] font-semibold hover:underline">{t.name}</button>
                        </td>
                        <td className="px-5 py-4 text-gray-700">Sharing Happiness</td>
                        <td className="px-5 py-4 text-gray-700 font-medium">
                          {t.category.charAt(0) + t.category.slice(1).toLowerCase()}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-400'}`} />
                            {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eef6ff] text-[#597ea3]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#597ea3] shrink-0" />
                            {t.language === 'id' ? 'Indonesian' : t.language === 'en_US' ? 'English (US)' : t.language}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <button
                            onClick={() => void handleDelete(t.id, t.name)}
                            disabled={deletingId === t.id}
                            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={6} className="px-5 py-2.5 text-xs text-gray-400 text-right">
                        1 / {Math.ceil(filtered.length / 10)} · {filtered.length} templates
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeftNav({ activeView, onChangeView }: { activeView: SubView; onChangeView: (v: SubView) => void }) {
  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col py-5 shrink-0">
      <div className="px-4 mb-3">
        <p className="text-xs font-bold text-gray-800 px-2 mb-2">Outbound Message</p>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Broadcast</p>
        <NavBtn icon={<Send className="w-4 h-4" />} label="WhatsApp Broadcast" active={activeView === 'wa-broadcast'} onClick={() => onChangeView('wa-broadcast')} />
      </div>
      <div className="px-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Templates</p>
        <NavBtn icon={<Layout className="w-4 h-4" />} label="WhatsApp Templates" active={activeView === 'wa-templates'} onClick={() => onChangeView('wa-templates')} />
      </div>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left group ${active ? 'bg-[#eef6ff] text-[#597ea3] font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
    >
      <span className={active ? 'text-[#597ea3]' : 'text-gray-400 group-hover:text-gray-600'}>{icon}</span>
      <span className="flex-1 leading-tight">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 text-[#597ea3] shrink-0" />}
    </button>
  );
}
