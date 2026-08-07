import React, { useState } from 'react';
import { User, Bell, Tag, Building2, Users, Zap, MessageSquareText } from 'lucide-react';
import type { Agent } from '@/types';
import TabButton from './TabButton';
import ProfileTab from './tabs/ProfileTab';
import CompaniesTab from './tabs/CompaniesTab';
import AgentsTab from './tabs/AgentsTab';
import LabelsTab from './tabs/LabelsTab';
import QuickReplyTab from './tabs/QuickReplyTab';
import ApiIntegrationTab from './tabs/ApiIntegrationTab';
type SettingsTab = 'profile' | 'companies' | 'agents' | 'labels' | 'quick-reply' | 'api-integration' | 'notifications';

interface SettingsPanelProps {
  agentName?: string;
  agent?: Agent;
  onProfileUpdate?: () => void;
  defaultTab?: SettingsTab;
}

export default function SettingsPanel({ agent, onProfileUpdate, defaultTab }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab || 'profile');

  return (
    <div className="flex-1 flex flex-col bg-saas-bg">
      <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5 shadow-soft">
        <h1 className="text-3xl font-bold leading-none">Settings</h1>
        <p className="text-sm text-white/80 font-medium mt-1">Manage your preferences and labels</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-white border-r border-saas-border p-4">
          <nav className="space-y-1">
            <TabButton icon={<User className="w-5 h-5" />} label="Account Management" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            <TabButton icon={<Building2 className="w-5 h-5" />} label="Companies" active={activeTab === 'companies'} onClick={() => setActiveTab('companies')} />
            <TabButton icon={<Users className="w-5 h-5" />} label="Agents" active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} />
            <TabButton icon={<Tag className="w-5 h-5" />} label="Labels" active={activeTab === 'labels'} onClick={() => setActiveTab('labels')} />
            <TabButton icon={<MessageSquareText className="w-5 h-5" />} label="Quick Reply" active={activeTab === 'quick-reply'} onClick={() => setActiveTab('quick-reply')} />
            <TabButton icon={<Zap className="w-5 h-5" />} label="API Integration" active={activeTab === 'api-integration'} onClick={() => setActiveTab('api-integration')} />
            <TabButton icon={<Bell className="w-5 h-5" />} label="Notifications" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && <ProfileTab agent={agent} onProfileUpdate={onProfileUpdate} />}
          {activeTab === 'companies' && <CompaniesTab agent={agent} />}
          {activeTab === 'agents' && <AgentsTab agent={agent} />}
          {activeTab === 'labels' && <LabelsTab />}
          {activeTab === 'quick-reply' && <QuickReplyTab />}
          {activeTab === 'api-integration' && <ApiIntegrationTab agent={agent} />}
          {activeTab === 'notifications' && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-saas-text-primary mb-6">Notification Preferences</h2>
              <div className="bg-white rounded-2xl p-6 border border-saas-border">
                <p className="text-gray-600">Notification settings coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

