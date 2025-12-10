/**
 * Feed Slice - Manejo del feed de posts
 * 
 * INTEGRACIÓN NOSQL:
 * - Neo4j: Query para obtener a quién sigue el usuario
 *   MATCH (u:User {id})-[:FOLLOWS]->(f:User) RETURN f.username
 * 
 * - MongoDB: Query para traer posts de esos usuarios
 *   db.posts.find({author_username: {$in: [usernames]}}).sort({created_at: -1})
 * 
 * - Redis Cluster: Cache del feed con hash tags
 *   Key: {user:alice}:feed:all
 *   TTL: 60 segundos
 *   Shard: Basado en hash de "user:alice" -> Master 1, 2 o 3
 * 
 * PATRÓN:
 * - Graph traversal (Neo4j) -> Document query (MongoDB) -> Cache (Redis)
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { postsAPI } from '../../services/api';

const initialState = {
  posts: [],
  loading: false,
  error: null,
  mode: 'all', // all, self, following
  hasMore: true,
};

/**
 * Fetch feed
 * 
 * Backend: GET /users/{username}/feed?mode=all&limit=20
 * 
 * Flujo en backend:
 * 1. Verificar Redis: GET {user:username}:feed:{mode}
 * 2. Si cache miss:
 *    a. Neo4j: Obtener siguiendo
 *    b. MongoDB: Query posts
 *    c. Redis: SETEX {user:username}:feed:{mode} 60 [posts_json]
 * 3. Retornar posts
 * 
 * REDIS CLUSTER:
 * - Key: {user:alice}:feed:all
 * - Hash de "user:alice" -> slot X -> Master Y
 * - Todos los feeds de alice están en el mismo master
 * - Permite invalidación ef iciente: DELETE {user:alice}:feed:*
 */
export const fetchFeed = createAsyncThunk(
  'feed/fetchFeed',
  async ({ username, mode = 'all', limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await postsAPI.getFeed(username, mode, limit);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar feed');
    }
  }
);

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setMode: (state, action) => {
      state.mode = action.payload;
    },
    clearFeed: (state) => {
      state.posts = [];
      state.hasMore = true;
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
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setMode, clearFeed } = feedSlice.actions;
export default feedSlice.reducer;
