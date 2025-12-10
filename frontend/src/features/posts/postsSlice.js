/**
 * Posts Slice - Crear posts y likes
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Almacenar post {author_username, content, tags, created_at}
 * - Neo4j: Crear nodo (:Post {id}) y relación (User)-[:POSTED]->(Post)
 * - Redis Cluster: Invalidar cache del feed del autor
 * 
 * LIKES:
 * - Redis Cluster (principal):
 *   Key: {post:abc123}:likes:count -> STRING (INCR/DECR)
 *   Key: {post:abc123}:likes:users -> SET de usernames
 *   Key: trending:posts -> ZSET (score = likes)
 * 
 * - Neo4j (relaciones):
 *   (User)-[:LIKES]->(Post)
 * 
 * - MongoDB (persistencia eventual):
 *   Sincronizar contador cada 5 minutos
 * 
 * REDIS CLUSTER:
 * - {post:abc123}:likes:count -> hash("post:abc123") -> slot -> Master
 * - {post:abc123}:likes:users -> mismo slot (mismo master)
 * - Pipeline atómico: INCR + SADD + ZINCRBY en un solo nodo
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { postsAPI } from '../../services/api';

const initialState = {
  loading: false,
  error: null,
  lastCreatedPost: null,
};

/**
 * Crear post
 * 
 * Backend: POST /posts/
 * 
 * Flujo:
 * 1. MongoDB: Insert post document
 * 2. Neo4j: CREATE (p:Post {id}), (u)-[:POSTED]->(p)
 * 3. Redis: DELETE {user:author}:feed:* (invalidar cache)
 */
export const createPost = createAsyncThunk(
  'posts/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      const response = await postsAPI.createPost(postData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al crear post');
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.loading = false;
        state.lastCreatedPost = action.payload;
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = postsSlice.actions;
export default postsSlice.reducer;
