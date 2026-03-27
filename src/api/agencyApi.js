import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001'
});

export const agencyApi = {
  getAll: async () => {
    const res = await api.get('/api/agencies');
    if (res.data.success) {
      return res.data.data;
    }
    throw new Error('Failed to fetch agencies');
  },
  
  create: async (data) => {
    const res = await api.post('/api/agencies', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.put(`/api/agencies/${id}`, data);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/api/agencies/${id}`);
    return res.data;
  }
};
