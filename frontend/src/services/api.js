/**
 * API Service - Cliente HTTP con axios
 * Centraliza todas las llamadas al backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

console.log('🔌 API Base URL:', API_BASE_URL);

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request
api.interceptors.request.use(
  (config) => {
    console.log('📤 Request:', config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor de response
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ Network Error:', error.message);
    } else {
      console.error('❌ Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ========== AUTH API ==========
export const authAPI = {
  register: (userData) => api.post('/users/', userData),
  login: (username) => api.get(`/users/by-username/${username}`),
  getUserByUsername: (username) => api.get(`/users/by-username/${username}`),
};

// ========== USERS API ==========
export const usersAPI = {
  listUsers: () => api.get('/users/'),
  followUser: (username, targetUsername) => 
    api.post(`/users/${username}/follow/${targetUsername}`),
  getFollowing: (username) => api.get(`/users/${username}/following`),
  getSuggestions: (username, limit = 10) => 
    api.get(`/users/${username}/suggestions`, { params: { limit } }),
};

// ========== POSTS API ==========
export const postsAPI = {
  createPost: (postData) => api.post('/posts/', postData),
  getFeed: (username, mode = 'all', limit = 20) => 
    api.get(`/users/${username}/feed`, { params: { mode, limit } }),
};

// ========== DMS API ==========
export const dmsAPI = {
  sendDM: (dmData) => api.post('/dm/send', dmData),
  getConversation: (username, otherUsername, limit = 50) => 
    api.get(`/dm/${username}/${otherUsername}`, { params: { limit } }),
  listConversations: (username) => api.get(`/dm/conversations/${username}`),
};

export default api;
