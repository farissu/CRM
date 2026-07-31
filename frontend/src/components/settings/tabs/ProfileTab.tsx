import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Lock, Save, Camera, X } from 'lucide-react';
import type { Agent } from '@/types';
import { agentApi } from '@/lib/api';
import { formatPhoneNumber, getRoleBadgeColor, getRoleLabel } from '../settingsUtils';

interface ProfileTabProps {
  agent?: Agent;
  onProfileUpdate?: () => void;
}

export default function ProfileTab({ agent, onProfileUpdate }: ProfileTabProps) {
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

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  useEffect(() => {
    if (agent) {
      setProfileData({
        name: agent.name || '',
        email: agent.email || '',
        phone: formatPhoneNumber(agent.phone || ''),
      });
    }
  }, [agent]);

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      await agentApi.updateProfile({
        ...profileData,
        phone: formatPhoneNumber(profileData.phone),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onProfileUpdate?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setCurrentPasswordError(null);
    setPasswordChangeSuccess(false);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      await agentApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(true);
      setPasswordChangeSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setTimeout(() => setPasswordChangeSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      const apiMessage = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg;
      if (apiMessage === 'Current password is incorrect') {
        setCurrentPasswordError(apiMessage);
      } else {
        setError(apiMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-saas-text-primary">Account Management</h2>
        <p className="text-gray-600 mt-1">Manage your account information and preferences</p>
      </div>

      {success && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-green-800 font-semibold">Changes saved successfully!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-saas-border shadow-soft">
        <div className="flex items-start gap-6 mb-6">
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
            onClick={() => void handleUpdateProfile()}
            disabled={loading}
            className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-saas-border shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-6 h-6 text-saas-primary-blue" />
          <div>
            <h3 className="text-xl font-bold text-saas-text-primary">Change Password</h3>
            <p className="text-sm text-gray-600">Update your password to keep your account secure</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, currentPassword: e.target.value });
                setCurrentPasswordError(null);
              }}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 font-medium ${
                currentPasswordError
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-saas-border focus:border-saas-primary-blue'
              }`}
              placeholder="Enter current password"
            />
            {currentPasswordError && (
              <p className="mt-1.5 text-sm font-medium text-red-600">{currentPasswordError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
              placeholder="Confirm new password"
            />
          </div>
          <button
            onClick={() => void handleChangePassword()}
            disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
          {passwordChangeSuccess && (
            <p className="text-sm font-medium text-green-600">Password updated successfully!</p>
          )}
        </div>
      </div>
    </div>
  );
}
