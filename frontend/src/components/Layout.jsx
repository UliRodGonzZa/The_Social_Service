/**
 * Layout - Estructura principal de la aplicación
 * Navbar + Contenido principal + Sidebar (opcional)
 */

import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children, showSidebar = false, sidebar = null }) => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      
      <div className="ml-64 flex">
        {/* Main Content */}
        <main className={`flex-1 ${showSidebar ? 'max-w-2xl' : 'max-w-3xl'} border-r border-dark-border min-h-screen`}>
          {children}
        </main>
        
        {/* Sidebar (opcional) */}
        {showSidebar && sidebar && (
          <aside className="w-80 p-4 sticky top-0 h-screen overflow-y-auto">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
};

export default Layout;
