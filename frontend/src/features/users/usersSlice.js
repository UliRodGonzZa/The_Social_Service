/**
 * Users Slice - Sugerencias, seguir usuarios
 * 
 * INTEGRACIÓN NOSQL:
 * - Neo4j (principal): Algoritmo de sugerencias
 *   MATCH (u:User {id})-[:FOLLOWS]->()-[:FOLLOWS]->(s:User)
 *   WHERE NOT (u)-[:FOLLOWS]->(s)
 *   RETURN s, COUNT(*) as mutual_connections
 * 
 * - Redis Cluster: Cache de sugerencias
 *   Key: {user:alice}:suggestions
 *   TTL: 600 segundos (10 minutos)
 *   Expensive query en Neo4j, cache largo
 * 
 * REDIS CLUSTER:
 * - {user:alice}:suggestions -> hash("user:alice") -> slot -> Master
 * - Invalidar al hacer follow/unfollow
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { usersAPI } from '../../services/api';

const initialState = {
  suggestions: [],
  loading: false,
  error: null,
};

/**
 * Get suggestions
 * 
 * Backend: GET /users/{username}/suggestions
 * 
 * Flujo:
 * 1. Redis: GET {user:username}:suggestions
 * 2. Si cache miss:
 *    a. Neo4j: Query compleja de grafo (2-hop traversal)
 *    b. Redis: SETEX {user:username}:suggestions 600 [suggestions_json]
 * 3. Retornar
 */
export const fetchSuggestions = createAsyncThunk(
  'users/fetchSuggestions',
  async (username, { rejectWithValue }) => {
    try {
      const response = await usersAPI.getSuggestions(username);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar sugerencias');
    }
  }
);

/**
 * Follow user
 * 
 * Backend: POST /users/{username}/follow/{target}
 * 
 * Flujo:
 * 1. Neo4j: MERGE (u)-[:FOLLOWS]->(t)
 * 2. Redis: DELETE {user:username}:suggestions (invalidar)
 * 3. Redis: DELETE {user:username}:feed:* (invalidar feeds)
 */
export const followUser = createAsyncThunk(
  'users/followUser',
  async ({ username, targetUsername }, { rejectWithValue }) => {
    try {
      const response = await usersAPI.followUser(username, targetUsername);
      return { ...response.data, targetUsername };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al seguir usuario');
    }
  }
);

/**
 * Unfollow user
 * 
 * Backend: DELETE /users/{username}/follow/{target}
 */
export const unfollowUser = createAsyncThunk(
  'users/unfollowUser',
  async ({ username, targetUsername }, { rejectWithValue }) => {
    try {
      const response = await usersAPI.unfollowUser(username, targetUsername);
      return { ...response.data, targetUsername };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al dejar de seguir usuario');
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuggestions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        state.loading = false;
        state.suggestions = action.payload;
      })
      .addCase(fetchSuggestions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(followUser.fulfilled, (state, action) => {
        // Remover el usuario seguido de las sugerencias
        state.suggestions = state.suggestions.filter(
          user => user.username !== action.payload.targetUsername
        );
      });
  },
});

export default usersSlice.reducer;
