/**
 * Profile Slice - Manejo de perfiles de usuario
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Datos del usuario, posts propios
 * - Neo4j: Conteo de seguidores/seguidos, relaciones FOLLOWS
 * - Redis: Caché de feeds (posts del usuario)
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI, usersAPI, postsAPI } from '../../services/api';

const initialState = {
  profileUser: null, // Usuario del perfil que se está viendo
  userPosts: [],
  following: [],
  isFollowing: false,
  loading: false,
  error: null,
};

// ========== THUNKS ==========

/**
 * Obtener datos de un usuario por username
 */
export const fetchUserProfile = createAsyncThunk(
  'profile/fetchUserProfile',
  async (username, { rejectWithValue }) => {
    try {
      const response = await authAPI.getUserByUsername(username);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Usuario no encontrado');
    }
  }
);

/**
 * Obtener posts de un usuario
 */
export const fetchUserPosts = createAsyncThunk(
  'profile/fetchUserPosts',
  async (username, { rejectWithValue }) => {
    try {
      const response = await postsAPI.getFeed(username, 'self', 50);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar posts');
    }
  }
);

/**
 * Obtener lista de usuarios que sigue
 */
export const fetchFollowing = createAsyncThunk(
  'profile/fetchFollowing',
  async (username, { rejectWithValue }) => {
    try {
      const response = await usersAPI.getFollowing(username);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al cargar seguidos');
    }
  }
);

/**
 * Seguir a un usuario
 */
export const followUser = createAsyncThunk(
  'profile/followUser',
  async ({ currentUsername, targetUsername }, { rejectWithValue }) => {
    try {
      const response = await usersAPI.followUser(currentUsername, targetUsername);
      return { targetUsername };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al seguir usuario');
    }
  }
);

/**
 * Dejar de seguir a un usuario
 */
export const unfollowUser = createAsyncThunk(
  'profile/unfollowUser',
  async ({ currentUsername, targetUsername }, { rejectWithValue }) => {
    try {
      const response = await usersAPI.unfollowUser(currentUsername, targetUsername);
      return { targetUsername };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Error al dejar de seguir');
    }
  }
);

// ========== SLICE ==========

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfile: (state) => {
      state.profileUser = null;
      state.userPosts = [];
      state.following = [];
      state.isFollowing = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // FETCH USER PROFILE
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profileUser = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // FETCH USER POSTS
    builder
      .addCase(fetchUserPosts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.userPosts = action.payload;
      })
      .addCase(fetchUserPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // FETCH FOLLOWING
    builder
      .addCase(fetchFollowing.fulfilled, (state, action) => {
        state.following = action.payload;
      });

    // FOLLOW USER
    builder
      .addCase(followUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(followUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isFollowing = true;
      })
      .addCase(followUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // UNFOLLOW USER
    builder
      .addCase(unfollowUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(unfollowUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isFollowing = false;
        // Remover del array de following
        state.following = state.following.filter(
          user => user.username !== action.payload.targetUsername
        );
      })
      .addCase(unfollowUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
