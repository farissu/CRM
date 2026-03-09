import React, { useState, useEffect } from 'react';
import { Plus, X, Tag, User, Bell, Camera, Mail, Phone, Shield, Lock, Save, Building2, Users, Edit, Zap } from 'lucide-react';
import type { Label, Agent, Role, Company } from '@/types';
import { labelApi, agentApi, companyApi } from '@/lib/api';

type SettingsTab = 'profile' | 'companies' | 'agents' | 'labels' | 'api-integration' | 'notifications';

interface SettingsPanelProps {
  agentName?: string;
  agent?: Agent;
  onProfileUpdate?: () => void;
  defaultTab?: SettingsTab;
}

export default function SettingsPanel({ agentName, agent, onProfileUpdate, defaultTab }: SettingsPanelProps) {
  // Helper function to format phone numbers
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // Remove dashes and spaces
    let formatted = phone.replace(/[-\s]/g, '');
    // Replace 62 prefix with 0
    if (formatted.startsWith('62')) {
      formatted = '0' + formatted.substring(2);
    }
    return formatted;
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab || 'profile');
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: agent?.name || '',
    email: agent?.email || '',
    phone: agent?.phone || '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    brand: '',
    address: '',
    businessEntities: '',
    businessType: '',
    email: '',
    phone: '',
  });

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'AGENT' as Role,
    companyId: '',
  });

  // Webhook state for API Integration
  const [webhookData, setWebhookData] = useState({
    webhookUrl: '',
    webhookCallbackUrl: '',
  });
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSuccess, setWebhookSuccess] = useState(false);

  // Sync profile data with agent prop
  useEffect(() => {
    if (agent) {
      setProfileData({
        name: agent.name || '',
        email: agent.email || '',
        phone: formatPhoneNumber(agent.phone || ''),
      });
    }
  }, [agent]);

  useEffect(() => {
    if (activeTab === 'labels') {
      loadLabels();
    } else if (activeTab === 'companies') {
      loadCompanies();
    } else if (activeTab === 'agents') {
      loadAgents();
      loadCompanies(); // For company select dropdown
    } else if (activeTab === 'api-integration') {
      loadWebhookData();
    }
  }, [activeTab, agent]);

  const loadLabels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await labelApi.getLabels();
      setLabels(response.labels);
    } catch (err: any) {
      console.error('Failed to load labels:', err);
      setError('Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await companyApi.getAllCompanies();
      setCompanies(response.companies);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentApi.getAllAgents();
      setAgents(response.agents);
    } catch (err: any) {
      console.error('Failed to load agents:', err);
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookData = async () => {
    try {
      if (!agent?.companyId) return;
      
      setLoading(true);
      setError(null);
      const response = await companyApi.getAllCompanies();
      const userCompany = response.companies.find((c: Company) => c.id === agent.companyId);
      
      if (userCompany) {
        setWebhookData({
          webhookUrl: userCompany.webhookUrl || '',
          webhookCallbackUrl: userCompany.webhookCallbackUrl || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to load webhook data:', err);
      setError('Failed to load webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      if (!agent?.companyId) {
        setError('No company associated with your account');
        return;
      }

      setWebhookLoading(true);
      setError(null);
      setWebhookSuccess(false);

      await companyApi.updateCompany(agent.companyId, {
        webhookUrl: webhookData.webhookUrl,
        webhookCallbackUrl: webhookData.webhookCallbackUrl,
      });

      setWebhookSuccess(true);
      setTimeout(() => setWebhookSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save webhook:', err);
      setError(err.response?.data?.error || 'Failed to save webhook configuration');
    } finally {
      setWebhookLoading(false);
    }
  };

  const predefinedColors = [
    '#EF4444', // Red
    '#F59E0B', // Orange
    '#10B981', // Green
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
  ];

  const handleAddLabel = async () => {
    if (newLabelName.trim()) {
      try {
        setLoading(true);
        setError(null);
        const response = await labelApi.createLabel({
          name: newLabelName.trim(),
          color: newLabelColor,
        });
        setLabels([...labels, response.label]);
        setNewLabelName('');
        setNewLabelColor('#3B82F6');
        setIsAdding(false);
      } catch (err: any) {
        console.error('Failed to create label:', err);
        setError(err.response?.data?.error || 'Failed to create label');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await labelApi.deleteLabel(id);
      setLabels(labels.filter(label => label.id !== id));
    } catch (err: any) {
      console.error('Failed to delete label:', err);
      setError(err.response?.data?.error || 'Failed to delete label');
    } finally {
      setLoading(false);
    }
  };
  const handleUpdateProfile = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      setProfileSuccess(false);

      // Format phone number before sending
      const formattedData = {
        ...profileData,
        phone: formatPhoneNumber(profileData.phone),
      };

      await agentApi.updateProfile(formattedData);
      
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setProfileError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setProfileError('Passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setProfileError('Password must be at least 6 characters');
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      setProfileSuccess(false);

      await agentApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to change password:', err);
      setProfileError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setProfileLoading(false);
    }
  };

  // Company handlers
  const handleEditCompany = (company: Company) => {
    setCompanyFormData({
      name: company.name,
      brand: company.brand || '',
      address: company.address || '',
      businessEntities: company.businessEntities || '',
      businessType: company.businessType || '',
      email: company.email || '',
      phone: formatPhoneNumber(company.phone || ''),
    });
    setEditingCompanyId(company.id);
    setIsEditingCompany(true);
  };

  const handleUpdateCompany = async () => {
    try {
      if (!companyFormData.name.trim()) {
        setError('Company name is required');
        return;
      }

      if (!editingCompanyId) {
        setError('No company selected for editing');
        return;
      }

      setLoading(true);
      setError(null);
      
      // Format phone number before sending
      const formattedCompanyData = {
        ...companyFormData,
        phone: formatPhoneNumber(companyFormData.phone),
      };
      
      const response = await companyApi.updateCompany(editingCompanyId, formattedCompanyData);
      setCompanies(companies.map(c => c.id === editingCompanyId ? response.company : c));
      setCompanyFormData({ name: '', brand: '', address: '', businessEntities: '', businessType: '', email: '', phone: '' });
      setEditingCompanyId(null);
      setIsEditingCompany(false);
    } catch (err: any) {
      console.error('Failed to update company:', err);
      setError(err.response?.data?.error || 'Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  // Agent handlers
  const handleCreateAgent = async () => {
    try {
      if (!agentFormData.name.trim() || !agentFormData.email.trim() || !agentFormData.password) {
        setError('Name, email, and password are required');
        return;
      }

      if (!agentFormData.companyId) {
        setError('Company is required');
        return;
      }

      setLoading(true);
      setError(null);
      
      // Format phone number before sending
      const formattedAgentData = {
        ...agentFormData,
        phone: formatPhoneNumber(agentFormData.phone),
      };
      
      const response = await agentApi.createAgent(formattedAgentData);
      setAgents([response.agent, ...agents]);
      setAgentFormData({ name: '', email: '', password: '', phone: '', role: 'AGENT', companyId: '' });
      setIsAddingAgent(false);
    } catch (err: any) {
      console.error('Failed to create agent:', err);
      setError(err.response?.data?.error || 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await agentApi.deleteAgent(agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (err: any) {
      console.error('Failed to delete agent:', err);
      setError(err.response?.data?.error || 'Failed to delete agent');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: Role): string => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-gradient-to-br from-purple-500 to-purple-600';
      case 'ADMIN':
        return 'bg-gradient-to-br from-blue-500 to-blue-600';
      case 'AGENT':
        return 'bg-gradient-to-br from-green-500 to-green-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role: Role): string => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Admin';
      case 'AGENT':
        return 'Agent';
      default:
        return role;
    }
  };
  return (
    <div className="flex-1 flex flex-col bg-saas-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5 shadow-soft">
        <h1 className="text-3xl font-bold leading-none">Settings</h1>
        <p className="text-sm text-white/80 font-medium mt-1">Manage your preferences and labels</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 bg-white border-r border-saas-border p-4">
          <nav className="space-y-1">
            <TabButton
              icon={<User className="w-5 h-5" />}
              label="Profile"
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            />
            
            {/* Companies tab - visible to all roles */}
            <TabButton
              icon={<Building2 className="w-5 h-5" />}
              label="Companies"
              active={activeTab === 'companies'}
              onClick={() => setActiveTab('companies')}
            />
            
            {/* Agents tab - visible to all roles */}
            <TabButton
              icon={<Users className="w-5 h-5" />}
              label="Agents"
              active={activeTab === 'agents'}
              onClick={() => setActiveTab('agents')}
            />

            <TabButton
              icon={<Tag className="w-5 h-5" />}
              label="Labels"
              active={activeTab === 'labels'}
              onClick={() => setActiveTab('labels')}
            />

            <TabButton
              icon={<Zap className="w-5 h-5" />}
              label="API Integration"
              active={activeTab === 'api-integration'}
              onClick={() => setActiveTab('api-integration')}
            />

            <TabButton
              icon={<Bell className="w-5 h-5" />}
              label="Notifications"
              active={activeTab === 'notifications'}
              onClick={() => setActiveTab('notifications')}
            />
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'labels' && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-saas-text-primary">Contact Labels</h2>
                  <p className="text-gray-600 mt-1">Create and manage labels to organize your contacts</p>
                </div>
                {!isAdding && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-soft-sm flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Label
                  </button>
                )}
              </div>

              {/* Add Label Form */}
              {isAdding && (
                <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
                  <h3 className="text-lg font-bold text-saas-text-primary mb-4">New Label</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Label Name</label>
                      <input
                        type="text"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="e.g., VIP, Priority, Follow Up"
                        className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
                      <div className="flex gap-3">
                        {predefinedColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewLabelColor(color)}
                            className={`w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110 ${
                              newLabelColor === color ? 'ring-4 ring-offset-2 ring-saas-primary-blue' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleAddLabel}
                        disabled={!newLabelName.trim()}
                        className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
                      >
                        Create Label
                      </button>
                      <button
                        onClick={() => {
                          setIsAdding(false);
                          setNewLabelName('');
                          setNewLabelColor('#3B82F6');
                        }}
                        className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Labels List */}
              <div className="space-y-3">
                {labels.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
                    <Tag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No labels yet</p>
                    <p className="text-gray-500 text-sm mt-1">Create your first label to get started</p>
                  </div>
                ) : (
                  labels.map((label) => (
                    <div
                      key={label.id}
                      className="bg-white rounded-2xl p-4 flex items-center justify-between hover:shadow-soft transition-all duration-200 border border-saas-border"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-soft-sm"
                          style={{ backgroundColor: label.color }}
                        >
                          <Tag className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-saas-text-primary">{label.name}</h3>
                          <p className="text-sm text-gray-500">{label.color}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-red-500 hover:text-red-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-saas-text-primary">Profile Settings</h2>
                <p className="text-gray-600 mt-1">Manage your account information and preferences</p>
              </div>

              {profileSuccess && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-green-800 font-semibold">Changes saved successfully!</p>
                </div>
              )}

              {profileError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-800 font-semibold">{profileError}</p>
                  <button onClick={() => setProfileError(null)} className="ml-auto text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Profile Information Card */}
              <div className="bg-white rounded-2xl p-6 border border-saas-border shadow-soft">
                <div className="flex items-start gap-6 mb-6">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center shadow-soft">
                      <span className="text-white font-bold text-3xl">
                        {agent?.name?.charAt(0).toUpperCase() || 'A'}
                      </span>
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white border-2 border-saas-primary-blue rounded-xl flex items-center justify-center hover:scale-105 transition-all duration-200 shadow-soft-sm">
                      <Camera className="w-5 h-5 text-saas-primary-blue" />
                    </button>
                  </div>

                  {/* Role Badge */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-saas-text-primary mb-2">{agent?.name || 'Agent'}</h3>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      <span className={`${getRoleBadgeColor(agent?.role || 'AGENT')} text-white px-3 py-1 rounded-lg text-sm font-bold shadow-soft-sm`}>
                        {getRoleLabel(agent?.role || 'AGENT')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {agent?.role === 'SUPER_ADMIN' && 'Can manage all workspaces and settings'}
                      {agent?.role === 'ADMIN' && 'Can manage team members and settings'}
                      {agent?.role === 'AGENT' && 'Can reply to messages and manage labels'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: formatPhoneNumber(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="081299998888"
                    />
                  </div>

                  <button
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                    className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="bg-white rounded-2xl p-6 border border-saas-border shadow-soft">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-saas-primary-blue" />
                  <div>
                    <h3 className="text-xl font-bold text-saas-text-primary">Change Password</h3>
                    <p className="text-sm text-gray-600">Update your password to keep your account secure</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter current password"
                    />
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter new password"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={profileLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {profileLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-saas-text-primary mb-6">Notification Preferences</h2>
              <div className="bg-white rounded-2xl p-6 border border-saas-border">
                <p className="text-gray-600">Notification settings coming soon...</p>
              </div>
            </div>
          )}

          {/* API Integration Tab */}
          {activeTab === 'api-integration' && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-saas-text-primary mb-6">API Integration</h2>
              <p className="text-gray-600 mb-6">
                Configure webhook URLs for WhatsApp Business API or other messaging platforms
              </p>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-800 font-semibold">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {webhookSuccess && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <Save className="w-5 h-5 text-green-500" />
                  <p className="text-green-800 font-semibold">Webhook configuration saved successfully!</p>
                </div>
              )}

              <div className="bg-white rounded-2xl p-6 border border-saas-border space-y-6">
                {/* Webhook URL for Incoming Messages */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Webhook URL (Incoming Messages)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    This URL will receive incoming messages from your customers via WhatsApp or other platforms
                  </p>
                  <input
                    type="url"
                    value={webhookData.webhookUrl}
                    onChange={(e) => setWebhookData({ ...webhookData, webhookUrl: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                    placeholder="https://your-domain.com/api/webhook/incoming"
                  />
                </div>

                {/* Webhook Callback URL for Status Updates */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Webhook Callback URL (Status Updates)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    This URL will receive status updates (sent, delivered, read) for messages you send
                  </p>
                  <input
                    type="url"
                    value={webhookData.webhookCallbackUrl}
                    onChange={(e) => setWebhookData({ ...webhookData, webhookCallbackUrl: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                    placeholder="https://your-domain.com/api/webhook/status"
                  />
                </div>

                <button
                  onClick={handleSaveWebhook}
                  disabled={webhookLoading}
                  className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {webhookLoading ? 'Saving...' : 'Save Configuration'}
                </button>

                {/* Info Box */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mt-6">
                  <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    How it works
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li><strong>Incoming Webhook:</strong> Receives POST requests when customers send messages</li>
                    <li><strong>Status Webhook:</strong> Receives POST requests for message delivery status updates</li>
                    <li>Make sure your webhook endpoints can accept POST requests with JSON payloads</li>
                    <li>Use HTTPS for secure communication</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <div className="max-w-5xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-saas-text-primary">Companies</h2>
                  <p className="text-gray-600 mt-1">
                    {agent?.role === 'SUPER_ADMIN' ? 'Manage all companies and workspaces' : 'View company information'}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-800 font-semibold">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Edit Company Form */}
              {isEditingCompany && editingCompanyId && (
                <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
                  <h3 className="text-lg font-bold text-saas-text-primary mb-4">Edit Company</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                        <input
                          type="text"
                          value={companyFormData.name}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                          placeholder="e.g., Acme Corporation"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Company Brand</label>
                        <input
                          type="text"
                          value={companyFormData.brand}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, brand: e.target.value })}
                          placeholder="e.g., Acme"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Company Address</label>
                      <input
                        type="text"
                        value={companyFormData.address}
                        onChange={(e) => setCompanyFormData({ ...companyFormData, address: e.target.value })}
                        placeholder="123 Main Street, City, State, ZIP"
                        className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Business Entities</label>
                        <input
                          type="text"
                          value={companyFormData.businessEntities}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, businessEntities: e.target.value })}
                          placeholder="e.g., LLC, Corp, Inc"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Business Type</label>
                        <input
                          type="text"
                          value={companyFormData.businessType}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, businessType: e.target.value })}
                          placeholder="e.g., Technology, Retail"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={companyFormData.email}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, email: e.target.value })}
                          placeholder="contact@company.com"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={companyFormData.phone}
                          onChange={(e) => setCompanyFormData({ ...companyFormData, phone: formatPhoneNumber(e.target.value) })}
                          placeholder="081299998888"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleUpdateCompany}
                        disabled={loading}
                        className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Company'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingCompany(false);
                          setEditingCompanyId(null);
                          setCompanyFormData({ name: '', brand: '', address: '', businessEntities: '', businessType: '', email: '', phone: '' });
                        }}
                        className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="bg-white rounded-2xl p-6 border border-saas-border hover:shadow-soft transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue flex items-center justify-center shadow-soft-sm">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-saas-text-primary">{company.name}</h3>
                          {company.brand && (
                            <p className="text-sm text-gray-500">{company.brand}</p>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full ${company.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {company.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      {agent?.role === 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleEditCompany(company)}
                          className="p-2 hover:bg-blue-50 rounded-xl transition-all duration-200 text-saas-primary-blue"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {company.address && (
                        <p className="text-sm text-gray-600 flex items-start gap-2">
                          <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{company.address}</span>
                        </p>
                      )}
                      {company.businessEntities && (
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Entity:</span> {company.businessEntities}
                        </p>
                      )}
                      {company.businessType && (
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Type:</span> {company.businessType}
                        </p>
                      )}
                      {company.email && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {company.email}
                        </p>
                      )}
                      {company.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {formatPhoneNumber(company.phone)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {companies.length === 0 && !isEditingCompany && (
                <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No companies found</p>
                  <p className="text-gray-500 text-sm mt-1">Contact your administrator for company setup</p>
                </div>
              )}
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="max-w-5xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-saas-text-primary">Agents</h2>
                  <p className="text-gray-600 mt-1">
                    {agent?.role === 'SUPER_ADMIN' ? 'Manage all agents and their access' : 'View team members in your company'}
                  </p>
                </div>
                {!isAddingAgent && agent?.role === 'SUPER_ADMIN' && (
                  <button
                    onClick={() => setIsAddingAgent(true)}
                    className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-soft-sm flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Agent
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-800 font-semibold">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Add Agent Form (Super Admin Only) */}
              {isAddingAgent && agent?.role === 'SUPER_ADMIN' && (
                <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
                  <h3 className="text-lg font-bold text-saas-text-primary mb-4">New Agent</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                        <input
                          type="text"
                          value={agentFormData.name}
                          onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                          placeholder="John Doe"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                        <input
                          type="email"
                          value={agentFormData.email}
                          onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                          placeholder="john@company.com"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                        <input
                          type="password"
                          value={agentFormData.password}
                          onChange={(e) => setAgentFormData({ ...agentFormData, password: e.target.value })}
                          placeholder="Min 6 characters"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={agentFormData.phone}
                          onChange={(e) => setAgentFormData({ ...agentFormData, phone: formatPhoneNumber(e.target.value) })}
                          placeholder="081299998888"
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                        <select
                          value={agentFormData.role}
                          onChange={(e) => setAgentFormData({ ...agentFormData, role: e.target.value as Role })}
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        >
                          <option value="AGENT">Agent</option>
                          <option value="ADMIN">Admin</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Company *</label>
                        <select
                          value={agentFormData.companyId}
                          onChange={(e) => setAgentFormData({ ...agentFormData, companyId: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                        >
                          <option value="">Select Company</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCreateAgent}
                        disabled={loading}
                        className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50"
                      >
                        {loading ? 'Creating...' : 'Create Agent'}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingAgent(false);
                          setAgentFormData({ name: '', email: '', password: '', phone: '', role: 'AGENT', companyId: '' });
                        }}
                        className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Agents List */}
              <div className="space-y-3">
                {agents.map((agentItem) => (
                  <div
                    key={agentItem.id}
                    className="bg-white rounded-2xl p-6 border border-saas-border hover:shadow-soft transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center shadow-soft-sm">
                          <span className="text-white font-bold text-xl">
                            {agentItem.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg text-saas-text-primary">{agentItem.name}</h3>
                            <span className={`${getRoleBadgeColor(agentItem.role)} text-white px-3 py-1 rounded-lg text-xs font-bold shadow-soft-sm`}>
                              {getRoleLabel(agentItem.role)}
                            </span>
                            {agentItem.company && (
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {agentItem.company.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              {agentItem.email}
                            </span>
                            {agentItem.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                {formatPhoneNumber(agentItem.phone)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {agent?.role === 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleDeleteAgent(agentItem.id)}
                          disabled={agentItem.id === agent?.id}
                          className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={agentItem.id === agent?.id ? 'Cannot delete yourself' : 'Delete agent'}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {agents.length === 0 && !isAddingAgent && (
                <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No agents yet</p>
                  <p className="text-gray-500 text-sm mt-1">Add your first agent to get started</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white shadow-soft-sm scale-102'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
