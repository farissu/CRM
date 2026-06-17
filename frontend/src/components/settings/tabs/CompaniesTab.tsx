import React, { useState, useEffect } from 'react';
import { Building2, Mail, Phone, Edit, X } from 'lucide-react';
import type { Agent, Company } from '@/types';
import { companyApi } from '@/lib/api';
import { formatPhoneNumber } from '../settingsUtils';

interface CompaniesTabProps {
  agent?: Agent;
}

const EMPTY_FORM = { name: '', brand: '', address: '', businessEntities: '', businessType: '', email: '', phone: '' };

export default function CompaniesTab({ agent }: CompaniesTabProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await companyApi.getAllCompanies();
      setCompanies(response.companies as Company[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company: Company) => {
    setFormData({
      name: company.name,
      brand: company.brand || '',
      address: company.address || '',
      businessEntities: company.businessEntities || '',
      businessType: company.businessType || '',
      email: company.email || '',
      phone: formatPhoneNumber(company.phone || ''),
    });
    setEditingId(company.id);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!formData.name.trim()) { setError('Company name is required'); return; }
    if (!editingId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await companyApi.updateCompany(editingId, {
        ...formData,
        phone: formatPhoneNumber(formData.phone),
      });
      setCompanies(companies.map(c => c.id === editingId ? response.company as Company : c));
      setFormData(EMPTY_FORM);
      setEditingId(null);
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update company';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => { setIsEditing(false); setEditingId(null); setFormData(EMPTY_FORM); };

  return (
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
          <button onClick={() => setError(null)} className="ml-auto text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isEditing && editingId && (
        <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">Edit Company</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Acme Corporation" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Brand</label>
                <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="e.g., Acme" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main Street, City, State, ZIP" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Business Entities</label>
                <input type="text" value={formData.businessEntities} onChange={(e) => setFormData({ ...formData, businessEntities: e.target.value })} placeholder="e.g., LLC, Corp, Inc" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Business Type</label>
                <input type="text" value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })} placeholder="e.g., Technology, Retail" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@company.com" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} placeholder="081299998888" className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => void handleUpdate()} disabled={loading} className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50">
                {loading ? 'Updating...' : 'Update Company'}
              </button>
              <button onClick={cancelEdit} className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => (
          <div key={company.id} className="bg-white rounded-2xl p-6 border border-saas-border hover:shadow-soft transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue flex items-center justify-center shadow-soft-sm">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-saas-text-primary">{company.name}</h3>
                  {company.brand && <p className="text-sm text-gray-500">{company.brand}</p>}
                  <span className={`text-xs px-2 py-1 rounded-full ${company.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {agent?.role === 'SUPER_ADMIN' && (
                <button onClick={() => handleEdit(company)} className="p-2 hover:bg-blue-50 rounded-xl transition-all duration-200 text-saas-primary-blue">
                  <Edit className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {company.address && <p className="text-sm text-gray-600 flex items-start gap-2"><Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{company.address}</span></p>}
              {company.businessEntities && <p className="text-sm text-gray-600"><span className="font-semibold">Entity:</span> {company.businessEntities}</p>}
              {company.businessType && <p className="text-sm text-gray-600"><span className="font-semibold">Type:</span> {company.businessType}</p>}
              {company.email && <p className="text-sm text-gray-600 flex items-center gap-2"><Mail className="w-4 h-4" />{company.email}</p>}
              {company.phone && <p className="text-sm text-gray-600 flex items-center gap-2"><Phone className="w-4 h-4" />{formatPhoneNumber(company.phone)}</p>}
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No companies found</p>
          <p className="text-gray-500 text-sm mt-1">Contact your administrator for company setup</p>
        </div>
      )}
    </div>
  );
}
