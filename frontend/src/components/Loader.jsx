/**
 * Loader - Componente de carga
 */

import React from 'react';

const Loader = ({ size = 'md', text = 'Cargando...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8" data-testid="loader">
      <div className={`${sizeClasses[size]} border-4 border-accent border-t-transparent rounded-full animate-spin`}></div>
      {text && <p className="mt-4 text-text-secondary">{text}</p>}
    </div>
  );
};

export default Loader;
