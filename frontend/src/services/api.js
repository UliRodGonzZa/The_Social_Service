/**
 * API Service - Cliente HTTP con axios
 * FIXED: URL directa sin depender de env vars
 */

import axios from 'axios';

// Usar variable de entorno con fallback
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://netveil.preview.emergentagent.com';

console.log('🔌 API Base URL:', API_BASE_URL);
console.log('🔌 Environment:', process.env.REACT_APP_BACKEND_URL);

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request
api.interceptors.request.use(
  (config) => {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('📤 Request:', config.method?.toUpperCase(), fullUrl);
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
      console.error('❌ API Error:', {
        status: error.response.status,
        url: error.config?.url,
        data: error.response.data
      });
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
  // Crear post: POST /posts/
  createPost: (postData) => api.post('/posts/', postData),
  
  // Obtener feed: GET /users/{username}/feed
  getFeed: (username, mode = 'all', limit = 20) => 
    api.get(`/users/${username}/feed`, { params: { mode, limit } }),
  
  // Like/Unlike post
  likePost: (postId, username) => 
    api.post(`/posts/${postId}/like`, null, { params: { username } }),
  
  unlikePost: (postId, username) => 
    api.delete(`/posts/${postId}/like`, { params: { username } }),
  
  getPostLikes: (postId, username = null) => 
    api.get(`/posts/${postId}/likes`, { params: { username } }),
  
  // Trending posts
  getTrendingPosts: (limit = 10) => 
    api.get('/trending/posts', { params: { limit } }),
};

// ========== DMS API ==========
export const dmsAPI = {
  sendDM: (dmData) => api.post('/dm/send', dmData),
  getConversation: (username, otherUsername, limit = 50) => 
    api.get(`/dm/${username}/${otherUsername}`, { params: { limit } }),
  listConversations: (username) => api.get(`/dm/conversations/${username}`),
};

export default api;
