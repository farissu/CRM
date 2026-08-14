import axios from 'axios';
import type { Conversation, ConversationsResponse, MessagesResponse, Message, Label, QuickReply, Agent, Company, Contact, MessageTemplate, TemplateCategory, TemplateComponent, Complaint, Broadcast, BroadcastsResponse } from '@/types';

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
    search?: string;
    includeCounts?: boolean;
    unreadOnly?: boolean;
    labelId?: string;
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
    text?: string;
    senderId: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    fileName?: string;
    fileSize?: number;
    caption?: string;
    quotedMessageId?: string;
  }): Promise<Message> => {
    const response = await api.post('/messages', data);
    return response.data;
  },

  reactToMessage: async (messageId: string, emoji: string): Promise<Message> => {
    const response = await api.post(`/messages/${messageId}/react`, { emoji });
    return response.data;
  },

  uploadMedia: async (file: File): Promise<{
    mediaUrl: string;
    mediaType: string;
    messageType: string;
    fileName: string;
    fileSize: number;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  assignLabelToContact: async (contactId: string, labelId: string): Promise<{ contact: Contact }> => {
    const response = await api.post('/labels/assign', { contactId, labelId });
    return response.data;
  },

  removeLabelFromContact: async (contactId: string, labelId: string): Promise<{ contact: Contact }> => {
    const response = await api.post('/labels/remove', { contactId, labelId });
    return response.data;
  },

  getContactLabels: async (contactId: string): Promise<{ labels: Label[] }> => {
    const response = await api.get(`/labels/contact/${contactId}`);
    return response.data;
  },
};

export const quickReplyApi = {
  getQuickReplies: async (params?: { active?: boolean }): Promise<{ quickReplies: QuickReply[] }> => {
    const response = await api.get('/quick-replies', { params });
    return response.data;
  },

  createQuickReply: async (data: { title: string; text: string; isActive?: boolean }): Promise<{ quickReply: QuickReply }> => {
    const response = await api.post('/quick-replies', data);
    return response.data;
  },

  updateQuickReply: async (id: string, data: { title?: string; text?: string; isActive?: boolean }): Promise<{ quickReply: QuickReply }> => {
    const response = await api.put(`/quick-replies/${id}`, data);
    return response.data;
  },

  deleteQuickReply: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/quick-replies/${id}`);
    return response.data;
  },
};

export const agentApi = {
  updateProfile: async (data: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
  }): Promise<{ agent: Agent }> => {
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

  getAllAgents: async (): Promise<{ agents: Agent[] }> => {
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
  }): Promise<{ agent: Agent }> => {
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
  }): Promise<{ agent: Agent }> => {
    const response = await api.put(`/agents/${agentId}`, data);
    return response.data;
  },

  updateAgentRole: async (agentId: string, role: string): Promise<{ agent: Agent }> => {
    const response = await api.put(`/agents/${agentId}/role`, { role });
    return response.data;
  },

  deleteAgent: async (agentId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/agents/${agentId}`);
    return response.data;
  },
};

export const companyApi = {
  getAllCompanies: async (): Promise<{ companies: Company[] }> => {
    const response = await api.get('/companies');
    return response.data;
  },

  getCompanyById: async (companyId: string): Promise<{ company: Company }> => {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },

  createCompany: async (data: {
    name: string;
    email?: string;
    phone?: string;
    logo?: string;
  }): Promise<{ company: Company }> => {
    const response = await api.post('/companies', data);
    return response.data;
  },

  updateCompany: async (companyId: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    logo?: string;
    isActive?: boolean;
    webhookUrl?: string;
    webhookCallbackUrl?: string;
  }): Promise<{ company: Company }> => {
    const response = await api.put(`/companies/${companyId}`, data);
    return response.data;
  },

  updateWebhook: async (companyId: string, data: {
    webhookUrl?: string;
    webhookCallbackUrl?: string;
  }): Promise<{ company: Company }> => {
    const response = await api.patch(`/companies/${companyId}/webhook`, data);
    return response.data;
  },

  deleteCompany: async (companyId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/companies/${companyId}`);
    return response.data;
  },
};

export const complaintApi = {
  createForConversation: async (conversationId: string, type: string = 'penilaian_konfirmasi'): Promise<Complaint> => {
    const response = await api.post('/complaints', { conversationId, type });
    return response.data;
  },
};

export const templateApi = {
  getTemplates: async (): Promise<{ templates: MessageTemplate[] }> => {
    const response = await api.get('/templates');
    return response.data as { templates: MessageTemplate[] };
  },

  getWabaInfo: async (): Promise<{ wabaId: string | null; namespace: string | null }> => {
    const response = await api.get('/templates/waba-info');
    return response.data as { wabaId: string | null; namespace: string | null };
  },

  createTemplate: async (data: {
    name: string;
    language: string;
    category: TemplateCategory;
    components: TemplateComponent[];
  }): Promise<{ template: MessageTemplate }> => {
    const response = await api.post('/templates', data);
    return response.data as { template: MessageTemplate };
  },

  syncTemplates: async (): Promise<{ templates: MessageTemplate[] }> => {
    const response = await api.post('/templates/sync');
    return response.data as { templates: MessageTemplate[] };
  },

  deleteTemplate: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/templates/${id}`);
    return response.data as { message: string };
  },

  uploadHeaderMedia: async (file: File): Promise<{ handle: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/templates/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { handle: string };
  },
};

export const broadcastApi = {
  getBroadcasts: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<BroadcastsResponse> => {
    const response = await api.get('/broadcasts', { params });
    return response.data as BroadcastsResponse;
  },

  getBroadcast: async (id: string): Promise<{ broadcast: Broadcast }> => {
    const response = await api.get(`/broadcasts/${id}`);
    return response.data as { broadcast: Broadcast };
  },

  createBroadcast: async (formData: FormData): Promise<{ broadcast: Broadcast }> => {
    const response = await api.post('/broadcasts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { broadcast: Broadcast };
  },

  sendTest: async (data: { templateId: string; to: string; bodyParams?: string[] }): Promise<{ waMessageId: string }> => {
    const response = await api.post('/broadcasts/test', data);
    return response.data as { waMessageId: string };
  },

  downloadExcelTemplate: async (templateId: string): Promise<Blob> => {
    const response = await api.get(`/broadcasts/excel-template/${templateId}`, { responseType: 'blob' });
    return response.data as Blob;
  },

  cancelBroadcast: async (id: string): Promise<{ broadcast: Broadcast }> => {
    const response = await api.delete(`/broadcasts/${id}`);
    return response.data as { broadcast: Broadcast };
  },
};
