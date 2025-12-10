/**
 * Feed Slice - FIXED: Mejor manejo de errores
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { postsAPI } from '../../services/api';

const initialState = {
  posts: [],
  loading: false,
  error: null,
  mode: 'all',
  hasMore: true,
};

/**
 * Fetch feed
 * Backend: GET /users/{username}/feed?mode={mode}&limit={limit}
 */
export const fetchFeed = createAsyncThunk(
  'feed/fetchFeed',
  async ({ username, mode = 'all', limit = 20 }, { rejectWithValue }) => {
    try {
      console.log('🔄 Fetching feed:', { username, mode, limit });
      const response = await postsAPI.getFeed(username, mode, limit);
      console.log('✅ Feed fetched:', response.data.length, 'posts');
      return response.data;
    } catch (error) {
      console.error('❌ Feed fetch error:', error);
      
      // Manejo específico de errores
      if (error.response) {
        // Error del servidor (404, 500, etc.)
        const message = error.response.data?.detail || 
                       `Error ${error.response.status}: ${error.response.statusText}`;
        return rejectWithValue(message);
      } else if (error.request) {
        // Error de red
        return rejectWithValue('No se pudo conectar al servidor. Verifica tu conexión.');
      } else {
        // Otro error
        return rejectWithValue(error.message || 'Error desconocido');
      }
    }
  }
);

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setMode: (state, action) => {
      state.mode = action.payload;
      state.error = null; // Limpiar error al cambiar modo
    },
    clearFeed: (state) => {
      state.posts = [];
      state.hasMore = true;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeed.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = action.payload;
        state.hasMore = action.payload.length >= 20;
        state.error = null; // Limpiar error en caso de éxito
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Error al cargar el feed';
        // NO vaciar posts en caso de error (mantener los que había)
      });
  },
});

export const { setMode, clearFeed, clearError } = feedSlice.actions;
export default feedSlice.reducer;
