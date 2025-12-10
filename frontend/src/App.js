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
import Layout from './components/Layout';

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
        
        {/* Placeholder routes */}
        <Route
          path="/trending"
          element={
            <Layout>
              <div className="p-8 text-center text-text-secondary">
                <h2 className="text-2xl font-bold mb-4">📈 Trending</h2>
                <p>Próximamente: Posts más populares</p>
              </div>
            </Layout>
          }
        />
        
        <Route
          path="/discover"
          element={
            <Layout>
              <div className="p-8 text-center text-text-secondary">
                <h2 className="text-2xl font-bold mb-4">👥 Descubrir</h2>
                <p>Próximamente: Recomendaciones de usuarios</p>
              </div>
            </Layout>
          }
        />
        
        <Route
          path="/messages"
          element={
            <Layout>
              <div className="p-8 text-center text-text-secondary">
                <h2 className="text-2xl font-bold mb-4">💬 Mensajes</h2>
                <p>Próximamente: Mensajes directos</p>
              </div>
            </Layout>
          }
        />
        
        <Route
          path="/profile/:username"
          element={
            <Layout>
              <div className="p-8 text-center text-text-secondary">
                <h2 className="text-2xl font-bold mb-4">👤 Perfil</h2>
                <p>Próximamente: Perfil de usuario</p>
              </div>
            </Layout>
          }
        />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
