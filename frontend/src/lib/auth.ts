import axios from 'axios';

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

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface Agent {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  agent: Agent;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  me: async (): Promise<{ agent: Agent }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('agent');
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  getAgent: (): Agent | null => {
    const agentStr = localStorage.getItem('agent');
    return agentStr ? JSON.parse(agentStr) : null;
  },

  setAuth: (token: string, agent: Agent) => {
    localStorage.setItem('token', token);
    localStorage.setItem('agent', JSON.stringify(agent));
  },
};

export default api;
