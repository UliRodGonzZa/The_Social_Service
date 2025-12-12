/**
 * AuthPage - Página de autenticación
 * Permite cambiar entre Login y Register
 */

import React, { useState } from "react";
import Login from "../features/auth/Login";
import Register from "../features/auth/Register";

const AuthPage = () => {
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="w-full max-w-6xl flex items-center justify-between">
        {/* Left side - Branding */}
        <div className="hidden md:block flex-1 pr-12">
          <div className="space-y-6">
            <div className="flex justify-between items-center w-full">
              <a
                href="https://github.com/KamCarrillo/The_Social_Service#"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/avatar.png"
                  alt="avatar"
                  className="w-42 h-35 rounded-full object-cover mb-8 
               cursor-pointer hover:brightness-110 hover:scale-110 
               transition-transform transition-filter duration-300"
                />
              </a>
              <h1 className="ml-10 text-6xl font-bold">The Social Service</h1>
            </div>

            <p className="text-2xl text-text-secondary">
              La red social que conecta personas a través de grafos, documentos
              y caché distribuido.
            </p>
            <div className="space-y-3 text-lg">
              <div className="flex items-center space-x-3">
                <span className="text-accent">✓</span>
                <span>Neo4j para relaciones sociales</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-accent">✓</span>
                <span>MongoDB para contenido rico</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-accent">✓</span>
                <span>Redis Cluster para velocidad</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Forms */}
        <div className="flex-1 flex justify-center">
          <div className="card p-8 w-full max-w-md">
            {showRegister ? (
              <Register onSwitchToLogin={() => setShowRegister(false)} />
            ) : (
              <Login onSwitchToRegister={() => setShowRegister(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
