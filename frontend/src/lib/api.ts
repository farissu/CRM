import axios from 'axios';
import type { Conversation, ConversationsResponse, MessagesResponse, Message, Label } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const conversationApi = {
  getConversations: async (params?: {
    agentId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ConversationsResponse> => {
    const response = await api.get('/conversations', { params });
    return response.data;
  },

  getConversationById: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/conversations/${id}`);
    return response.data;
  },

  assignAgent: async (conversationId: string, agentId: string): Promise<Conversation> => {
    const response = await api.patch(`/conversations/${conversationId}/assign`, { agentId });
    return response.data;
  },

  resolveConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await api.patch(`/conversations/${conversationId}/resolve`);
    return response.data;
  },

  markAsRead: async (conversationId: string): Promise<Conversation> => {
    const response = await api.patch(`/conversations/${conversationId}/read`);
    return response.data;
  },
};

export const messageApi = {
  getMessages: async (
    conversationId: string,
    params?: { page?: number; limit?: number }
  ): Promise<MessagesResponse> => {
    const response = await api.get(`/conversations/${conversationId}/messages`, { params });
    return response.data;
  },

  sendMessage: async (data: {
    conversationId: string;
    text: string;
    senderId: string;
  }): Promise<Message> => {
    const response = await api.post('/messages', data);
    return response.data;
  },
};

export const labelApi = {
  getLabels: async (): Promise<{ labels: Label[] }> => {
    const response = await api.get('/labels');
    return response.data;
  },

  createLabel: async (data: { name: string; color: string }): Promise<{ label: Label }> => {
    const response = await api.post('/labels', data);
    return response.data;
  },

  updateLabel: async (id: string, data: { name: string; color: string }): Promise<{ label: Label }> => {
    const response = await api.put(`/labels/${id}`, data);
    return response.data;
  },

  deleteLabel: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/labels/${id}`);
    return response.data;
  },

  assignLabelToContact: async (contactId: string, labelId: string): Promise<{ contact: any }> => {
    const response = await api.post('/labels/assign', { contactId, labelId });
    return response.data;
  },

  removeLabelFromContact: async (contactId: string, labelId: string): Promise<{ contact: any }> => {
    const response = await api.post('/labels/remove', { contactId, labelId });
    return response.data;
  },

  getContactLabels: async (contactId: string): Promise<{ labels: Label[] }> => {
    const response = await api.get(`/labels/contact/${contactId}`);
    return response.data;
  },
};

export const agentApi = {
  updateProfile: async (data: { 
    name?: string; 
    email?: string; 
    phone?: string; 
    avatar?: string;
  }): Promise<{ agent: any }> => {
    const response = await api.put('/agents/profile', data);
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    const response = await api.post('/agents/change-password', data);
    return response.data;
  },

  getAllAgents: async (): Promise<{ agents: any[] }> => {
    const response = await api.get('/agents/all');
    return response.data;
  },

  createAgent: async (data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    companyId?: string;
    phone?: string;
    avatar?: string;
  }): Promise<{ agent: any }> => {
    const response = await api.post('/agents', data);
    return response.data;
  },

  updateAgent: async (agentId: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    role?: string;
    companyId?: string;
    isActive?: boolean;
  }): Promise<{ agent: any }> => {
    const response = await api.put(`/agents/${agentId}`, data);
    return response.data;
  },

  updateAgentRole: async (agentId: string, role: string): Promise<{ agent: any }> => {
    const response = await api.put(`/agents/${agentId}/role`, { role });
    return response.data;
  },

  deleteAgent: async (agentId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/agents/${agentId}`);
    return response.data;
  },
};

export const companyApi = {
  getAllCompanies: async (): Promise<{ companies: any[] }> => {
    const response = await api.get('/companies');
    return response.data;
  },

  getCompanyById: async (companyId: string): Promise<{ company: any }> => {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },

  createCompany: async (data: {
    name: string;
    email?: string;
    phone?: string;
    logo?: string;
  }): Promise<{ company: any }> => {
    const response = await api.post('/companies', data);
    return response.data;
  },

  updateCompany: async (companyId: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    logo?: string;
    isActive?: boolean;
  }): Promise<{ company: any }> => {
    const response = await api.put(`/companies/${companyId}`, data);
    return response.data;
  },

  deleteCompany: async (companyId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/companies/${companyId}`);
    return response.data;
  },
};

export default api;
