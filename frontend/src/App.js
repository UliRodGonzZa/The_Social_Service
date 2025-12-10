/**
 * App - Aplicación principal
 * Router y protección de rutas
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';

// Pages
import AuthPage from './pages/AuthPage';
import FeedPage from './pages/FeedPage';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Restaurar sesión desde localStorage al cargar
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Route */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/feed" replace /> : <AuthPage />
          }
        />
        
        {/* Protected Routes */}
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <FeedPage />
            </ProtectedRoute>
          }
        />
        
        {/* Placeholder routes - TODO: Implementar */}
        <Route
          path="/trending"
          element={
            <ProtectedRoute>
              <div className="p-8 text-center">Trending - Próximamente</div>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <div className="p-8 text-center">Descubrir - Próximamente</div>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <div className="p-8 text-center">Mensajes - Próximamente</div>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/profile/:username"
          element={
            <ProtectedRoute>
              <div className="p-8 text-center">Perfil - Próximamente</div>
            </ProtectedRoute>
          }
        />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
