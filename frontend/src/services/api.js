/**
 * API Service - Cliente HTTP con axios
 * Centraliza todas las llamadas al backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request (para agregar token si hay auth)
api.interceptors.request.use(
  (config) => {
    // En el futuro, agregar token JWT aquí si se implementa
    const user = localStorage.getItem('currentUser');
    if (user) {
      // Por ahora solo guardamos el username en localStorage
      // config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de response (para manejo de errores global)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // El servidor respondió con un status fuera del rango 2xx
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // La request fue hecha pero no hubo respuesta
      console.error('Network Error:', error.message);
    } else {
      // Algo pasó al configurar la request
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ========== AUTH API ==========
export const authAPI = {
  // Crear usuario (registro)
  register: (userData) => api.post('/users/', userData),
  
  // Login (verificar que usuario existe)
  login: (username) => api.get(`/users/by-username/${username}`),
  
  // Obtener usuario por username
  getUserByUsername: (username) => api.get(`/users/by-username/${username}`),
};

// ========== USERS API ==========
export const usersAPI = {
  // Listar usuarios
  listUsers: () => api.get('/users/'),
  
  // Seguir usuario
  followUser: (username, targetUsername) => 
    api.post(`/users/${username}/follow/${targetUsername}`),
  
  // Obtener siguiendo
  getFollowing: (username) => api.get(`/users/${username}/following`),
  
  // Obtener sugerencias
  getSuggestions: (username, limit = 10) => 
    api.get(`/users/${username}/suggestions`, { params: { limit } }),
};

// ========== POSTS API ==========
export const postsAPI = {
  // Crear post
  createPost: (postData) => api.post('/posts/', postData),
  
  // Obtener feed
  getFeed: (username, mode = 'all', limit = 20) => 
    api.get(`/users/${username}/feed`, { params: { mode, limit } }),
};

// ========== DMS API ==========
export const dmsAPI = {
  // Enviar DM
  sendDM: (dmData) => api.post('/dm/send', dmData),
  
  // Obtener conversación
  getConversation: (username, otherUsername, limit = 50) => 
    api.get(`/dm/${username}/${otherUsername}`, { params: { limit } }),
  
  // Listar conversaciones
  listConversations: (username) => api.get(`/dm/conversations/${username}`),
};

export default api;
