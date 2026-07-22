'use client';

import React, { useState } from 'react';
import { agentApi } from '@/lib/api';

interface ForceChangePasswordPageProps {
  onPasswordChanged: () => void;
}

export default function ForceChangePasswordPage({ onPasswordChanged }: ForceChangePasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }

    setLoading(true);
    try {
      await agentApi.changePassword({ currentPassword, newPassword });
      onPasswordChanged();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-saas-primary-blue via-saas-secondary-blue to-saas-accent-blue">
      <div className="bg-white rounded-3xl shadow-soft p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-saas-text-primary mb-2">Set a New Password</h1>
          <p className="text-gray-600 font-medium">
            This account is using a temporary password. Please set your own password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-6 font-medium">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="currentPassword" className="block text-saas-text-primary font-semibold mb-2">
              Temporary Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-5 py-4 border-2 border-saas-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-saas-primary-blue focus:border-transparent transition-all duration-200 font-medium"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="newPassword" className="block text-saas-text-primary font-semibold mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-5 py-4 border-2 border-saas-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-saas-primary-blue focus:border-transparent transition-all duration-200 font-medium"
              placeholder="At least 8 characters"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-7">
            <label htmlFor="confirmPassword" className="block text-saas-text-primary font-semibold mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-5 py-4 border-2 border-saas-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-saas-primary-blue focus:border-transparent transition-all duration-200 font-medium"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white py-4 rounded-2xl font-bold hover:shadow-soft transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] disabled:hover:scale-100 shadow-soft-sm"
          >
            {loading ? 'Saving...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
