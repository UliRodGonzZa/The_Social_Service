/**
 * Auth Slice - Manejo de autenticación
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Almacena usuarios (username, email, name, bio)
 * - Neo4j: Crea nodo (:User {id, username}) para relaciones sociales
 * - Redis Cluster: NO se usa en auth (simple sin sesiones)
 * 
 * PATRÓN:
 * - Document DB (MongoDB) para datos del usuario
 * - Graph DB (Neo4j) para preparar grafo social
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api';

// Estado inicial
const initialState = {
  currentUser: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// ========== THUNKS (Acciones asíncronas) ==========

/**
 * Registro de usuario
 * 
 * Backend: POST /users/
 * MongoDB: Inserta documento en colección 'users'
 * Neo4j: Crea nodo (:User {id, username, email, name, bio})
 */
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al registrar usuario');
    }
  }
);

/**
 * Login de usuario (verificar existencia)
 * 
 * Backend: GET /users/by-username/{username}
 * MongoDB: Query find_one({username})
 * Neo4j: No se usa en login
 */
export const login = createAsyncThunk(
  'auth/login',
  async (username, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(username);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Usuario no encontrado');
    }
  }
);

// ========== SLICE ==========

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Logout (limpiar estado)
    logout: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      localStorage.removeItem('currentUser');
    },
    
    // Restaurar sesión desde localStorage
    restoreSession: (state) => {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          state.currentUser = JSON.parse(savedUser);
          state.isAuthenticated = true;
        } catch (error) {
          localStorage.removeItem('currentUser');
        }
      }
    },
    
    // Auto-login (para modo demo)
    setDemoUser: (state, action) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem('currentUser', JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    // ===== REGISTER =====
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        // Persistir en localStorage
        localStorage.setItem('currentUser', JSON.stringify(action.payload));
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ===== LOGIN =====
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        // Persistir en localStorage
        localStorage.setItem('currentUser', JSON.stringify(action.payload));
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, restoreSession } = authSlice.actions;
export default authSlice.reducer;
