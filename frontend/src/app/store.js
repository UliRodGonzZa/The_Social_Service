/**
 * Redux Store - Configuración central
 * Integra todos los slices de features
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import feedReducer from '../features/feed/feedSlice';
import postsReducer from '../features/posts/postsSlice';
import usersReducer from '../features/users/usersSlice';
import messagesReducer from '../features/messages/messagesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    feed: feedReducer,
    posts: postsReducer,
    users: usersReducer,
    messages: messagesReducer,
  },
  // Middleware por defecto incluye redux-thunk
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorar estas actions/paths para checks de serialización
        ignoredActions: ['feed/fetchFeed/fulfilled'],
      },
    }),
});

export default store;
