import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || '';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

export const market = {
  snapshot: () => api.get('/api/market/snapshot').then(r => r.data),
  history: (days = 90) => api.get('/api/market/history', { params: { days } }).then(r => r.data),
  prices: (limit = 200) => api.get('/api/market/prices', { params: { limit } }).then(r => r.data),
};

export const signals = {
  generate: () => api.post('/api/signal/generate').then(r => r.data),
  latest: () => api.get('/api/signal/latest').then(r => r.data),
  history: (limit = 50) => api.get('/api/signal/history', { params: { limit } }).then(r => r.data),
};

export const trades = {
  list: () => api.get('/api/trades').then(r => r.data),
  create: (data) => api.post('/api/trades', data).then(r => r.data),
  close: (id, data) => api.patch(`/api/trades/${id}/close`, data).then(r => r.data),
  performance: () => api.get('/api/trades/performance').then(r => r.data),
};

export const backtest = {
  run: (params) => api.post('/api/backtest/run', params).then(r => r.data),
  history: () => api.get('/api/backtest/history').then(r => r.data),
};

export const portfolio = {
  snapshots: () => api.get('/api/portfolio').then(r => r.data),
};
