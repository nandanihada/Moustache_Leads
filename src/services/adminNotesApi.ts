import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminNotesApi = {
  getNotes: async (filters?: {
    search?: string;
    page?: string;
    type?: string;
    status?: string;
    priority?: string;
    sort?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.sort) params.append('sort', filters.sort);

    const response = await api.get(`/api/admin/notes?${params.toString()}`);
    return response.data;
  },

  createNote: async (noteData: {
    title: string;
    type: string;
    priority?: string;
    page: string;
    assignee?: string;
    body?: string;
  }) => {
    const response = await api.post('/api/admin/notes', noteData);
    return response.data;
  },

  getNote: async (noteId: string) => {
    const response = await api.get(`/api/admin/notes/${noteId}`);
    return response.data;
  },

  updateNote: async (noteId: string, updateData: any) => {
    const response = await api.put(`/api/admin/notes/${noteId}`, updateData);
    return response.data;
  },

  deleteNote: async (noteId: string) => {
    const response = await api.delete(`/api/admin/notes/${noteId}`);
    return response.data;
  },

  updateNoteStatus: async (noteId: string, status: string) => {
    const response = await api.patch(`/api/admin/notes/${noteId}/status`, { status });
    return response.data;
  },

  getCounts: async () => {
    const response = await api.get('/api/admin/notes/counts');
    return response.data;
  },
};
