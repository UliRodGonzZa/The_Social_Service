/**
 * Register Component - Formulario de registro
 * Auth simple: username + email (sin password)
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { register } from './authSlice';
import Loader from '../../components/Loader';

const Register = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    bio: '',
  });
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim()) return;

    const result = await dispatch(register(formData));
    if (result.type === 'auth/register/fulfilled') {
      navigate('/feed');
    }
  };

  return (
    <div className="w-full max-w-md" data-testid="register-form">
      <h2 className="text-3xl font-bold mb-6">Crear Cuenta</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-2">
            Nombre de usuario *
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            className="input"
            placeholder="username"
            disabled={loading}
            data-testid="register-username-input"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            placeholder="tu@email.com"
            disabled={loading}
            data-testid="register-email-input"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nombre completo (opcional)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="input"
            placeholder="Tu nombre"
            disabled={loading}
            data-testid="register-name-input"
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium mb-2">
            Biografía (opcional)
          </label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            className="textarea"
            placeholder="Cuéntanos sobre ti..."
            rows="3"
            disabled={loading}
            data-testid="register-bio-input"
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-lg" data-testid="register-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !formData.username.trim() || !formData.email.trim()}
          className="btn-primary w-full"
          data-testid="register-submit-button"
        >
          {loading ? 'Creando cuenta...' : 'Registrarse'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-accent hover:underline"
            data-testid="switch-to-login-button"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;
