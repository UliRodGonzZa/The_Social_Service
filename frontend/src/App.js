/**
 * App - Aplicación principal
 * MODO DEMO: Login temporalmente deshabilitado
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setDemoUser } from './features/auth/authSlice';

// Pages
import FeedPage from './pages/FeedPage';
import TrendingPage from './pages/TrendingPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';

function App() {
  const dispatch = useDispatch();

  // Auto-login con usuario Alice al cargar la app
  useEffect(() => {
    const demoUser = {
      id: "6938f6f4c4638c608cd5fc7f",
      username: "alice",
      email: "alice@redk.com",
      name: "Alice Smith",
      bio: "Full-stack developer passionate about NoSQL databases"
    };
    
    // Establecer usuario demo automáticamente
    dispatch(setDemoUser(demoUser));
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to feed */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        
        {/* Feed Route */}
        <Route path="/feed" element={<FeedPage />} />
        
        {/* Feature pages */}
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
