import axios from 'axios';
import { supabase } from './supabase';

const BASE = process.env.REACT_APP_API_URL || '';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

// Attach JWT token to every request so backend knows who the user is
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

export const market = {
  snapshot:    () => api.get('/api/market/snapshot').then(r => r.data),
  history:     (days = 90) => api.get('/api/market/history', { params: { days } }).then(r => r.data),
  prices:      (limit = 200) => api.get('/api/market/prices', { params: { limit } }).then(r => r.data),
  premarket:   () => api.get('/api/market/premarket').then(r => r.data),
  sectors:     () => api.get('/api/market/sectors').then(r => r.data),
  optionsFlow: () => api.get('/api/market/options-flow').then(r => r.data),
};

export const news = {
  feed:     () => api.get('/api/news').then(r => r.data),
  calendar: () => api.get('/api/news/calendar').then(r => r.data),
};

export const signals = {
  generate: () => api.post('/api/signal/generate').then(r => r.data),
  latest:   () => api.get('/api/signal/latest').then(r => r.data),
  history:  (limit = 100) => api.get('/api/signal/history', { params: { limit } }).then(r => r.data),
  outcome:  (id, data) => api.patch(`/api/signal/${id}/outcome`, data).then(r => r.data),
};

export const personalTrades = {
  list:   () => api.get('/api/personal-trades').then(r => r.data),
  create: (data) => api.post('/api/personal-trades', data).then(r => r.data),
  close:  (id, data) => api.patch(`/api/personal-trades/${id}/close`, data).then(r => r.data),
};

export const analytics = {
  summary: () => api.get('/api/analytics/summary').then(r => r.data),
  export:  () => api.get('/api/analytics/export').then(r => r.data),
};

export const trades = {
  list:        () => api.get('/api/trades').then(r => r.data),
  create:      (data) => api.post('/api/trades', data).then(r => r.data),
  close:       (id, data) => api.patch(`/api/trades/${id}/close`, data).then(r => r.data),
  performance: () => api.get('/api/trades/performance').then(r => r.data),
};

export const backtest = {
  run:     (params) => api.post('/api/backtest/run', params).then(r => r.data),
  history: () => api.get('/api/backtest/history').then(r => r.data),
};

export const portfolio = {
  snapshots: () => api.get('/api/portfolio').then(r => r.data),
};
