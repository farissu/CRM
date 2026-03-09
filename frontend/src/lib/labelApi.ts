import { apiClient } from './api';
import type { Label } from '@/types';

interface CreateLabelRequest {
  name: string;
  color: string;
}

interface AssignLabelRequest {
  labelId: string;
}

export const labelApi = {
  // Get all labels
  getLabels: async (): Promise<Label[]> => {
    const response = await apiClient.get('/labels');
    return response.data;
  },

  // Create new label
  createLabel: async (data: CreateLabelRequest): Promise<Label> => {
    const response = await apiClient.post('/labels', data);
    return response.data;
  },

  // Delete label
  deleteLabel: async (id: string): Promise<void> => {
    await apiClient.delete(`/labels/${id}`);
  },

  // Assign label to contact
  assignLabel: async (contactId: string, labelId: string): Promise<void> => {
    await apiClient.post(`/contacts/${contactId}/labels`, { labelId });
  },

  // Remove label from contact
  removeLabel: async (contactId: string, labelId: string): Promise<void> => {
    await apiClient.delete(`/contacts/${contactId}/labels/${labelId}`);
  },
};
