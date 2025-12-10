/**
 * Login Component - Formulario de inicio de sesión
 * Auth simple: solo username, sin password
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from './authSlice';
import Loader from '../../components/Loader';

const Login = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    const result = await dispatch(login(username.trim()));
    if (result.type === 'auth/login/fulfilled') {
      navigate('/feed');
    }
  };

  return (
    <div className="w-full max-w-md" data-testid="login-form">
      <h2 className="text-3xl font-bold mb-6">Iniciar Sesión</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-2">
            Nombre de usuario
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            placeholder="Ingresa tu username"
            disabled={loading}
            data-testid="login-username-input"
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-lg" data-testid="login-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="btn-primary w-full"
          data-testid="login-submit-button"
        >
          {loading ? 'Iniciando...' : 'Iniciar Sesión'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          ¿No tienes cuenta?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-accent hover:underline"
            data-testid="switch-to-register-button"
          >
            Regístrate
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
