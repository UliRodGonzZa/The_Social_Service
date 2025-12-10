/**
 * App - Aplicación principal con autenticación
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';

// Pages
import AuthPage from './pages/AuthPage';
import FeedPage from './pages/FeedPage';
import TrendingPage from './pages/TrendingPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, currentUser } = useSelector((state) => state.auth);
  const [isLoading, setIsLoading] = React.useState(true);

  // Restaurar sesión desde localStorage al cargar la app
  useEffect(() => {
    const restoreAuth = async () => {
      await dispatch(restoreSession());
      setIsLoading(false);
    };
    restoreAuth();
  }, [dispatch]);
  
  // Mostrar loader mientras se restaura la sesión
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Route */}
        <Route 
          path="/auth" 
          element={
            isAuthenticated ? <Navigate to="/feed" replace /> : <AuthPage />
          } 
        />
        
        {/* Redirect root to auth or feed */}
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/feed" : "/auth"} replace />} 
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
        
        <Route 
          path="/trending" 
          element={
            <ProtectedRoute>
              <TrendingPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/discover" 
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/messages" 
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/profile/:username" 
          element={
            <ProtectedRoute>
              <ProfilePage />
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
