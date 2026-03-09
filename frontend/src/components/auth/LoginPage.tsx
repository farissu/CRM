'use client';

import React, { useState } from 'react';
import { authApi } from '@/lib/auth';

interface LoginPageProps {
  onLoginSuccess: (agentId: string, agentName: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      
      // Save auth data
      authApi.setAuth(response.token, response.agent);
      
      // Notify parent component
      onLoginSuccess(response.agent.id, response.agent.name);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-saas-primary-blue via-saas-secondary-blue to-saas-accent-blue">
      <div className="bg-white rounded-3xl shadow-soft p-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 ">
            <img 
              src="/Logo.svg" 
              alt="Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl font-bold text-saas-text-primary mb-2">WhatsApp CRM</h1>
          <p className="text-gray-600 font-semibold">Agent Login</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-6 font-medium">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="email" className="block text-saas-text-primary font-semibold mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 border-2 border-saas-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-saas-primary-blue focus:border-transparent transition-all duration-200 font-medium"
              placeholder="admin@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-7">
            <label htmlFor="password" className="block text-saas-text-primary font-semibold mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 border-2 border-saas-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-saas-primary-blue focus:border-transparent transition-all duration-200 font-medium"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white py-4 rounded-2xl font-bold hover:shadow-soft transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] disabled:hover:scale-100 shadow-soft-sm"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Demo Credentials */}
        {/* <div className="mt-6 p-5 bg-saas-bg rounded-2xl border border-saas-border">
          <p className="text-sm text-gray-600 text-center font-medium">
            <strong className="text-saas-text-primary">Demo Credentials:</strong>
            <br />
            Email: admin@example.com
            <br />
            Password: admin123
          </p>
        </div> */}
      </div>
    </div>
  );
}
