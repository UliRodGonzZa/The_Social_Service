/**
 * Messages Slice - Mensajes directos
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Almacenar mensajes {sender, receiver, content, created_at, read}
 * - Neo4j: Relación (User)-[:MESSAGED]->(User) con timestamp
 * - Redis Cluster: Cache de conversaciones
 * 
 * REDIS CLUSTER:
 * - {conv:alice::bob}:messages -> hash("conv:alice::bob") -> slot -> Master
 * - Ordenar usernames alfabéticamente para consistencia
 * - TTL: 300 segundos (5 minutos)
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dmsAPI } from '../../services/api';

const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null,
};

/**
 * Fetch conversations
 * 
 * Backend: GET /dm/conversations/{username}
 */
export const fetchConversations = createAsyncThunk(
  'messages/fetchConversations',
  async (username, { rejectWithValue }) => {
    try {
      const response = await dmsAPI.listConversations(username);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar conversaciones');
    }
  }
);

/**
 * Fetch conversation
 * 
 * Backend: GET /dm/{username}/{other}
 * 
 * Flujo:
 * 1. Redis: GET {conv:alice::bob}:messages
 * 2. Si cache miss:
 *    a. MongoDB: Query messages
 *    b. Redis: SETEX {conv:alice::bob}:messages 300 [messages_json]
 * 3. Retornar
 */
export const fetchConversation = createAsyncThunk(
  'messages/fetchConversation',
  async ({ username, otherUsername }, { rejectWithValue }) => {
    try {
      const response = await dmsAPI.getConversation(username, otherUsername);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar mensajes');
    }
  }
);

/**
 * Send message
 * 
 * Backend: POST /dm/send
 * 
 * Flujo:
 * 1. MongoDB: Insert message
 * 2. Neo4j: MERGE (u)-[:MESSAGED]->(other)
 * 3. Redis: DELETE {conv:alice::bob}:messages (invalidar)
 */
export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async (messageData, { rejectWithValue }) => {
    try {
      const response = await dmsAPI.sendDM(messageData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al enviar mensaje');
    }
  }
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(fetchConversation.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.messages.push(action.payload);
      });
  },
});

export const { setCurrentConversation } = messagesSlice.actions;
export default messagesSlice.reducer;
