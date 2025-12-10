/**
 * DemoNotice - Aviso de modo demo
 */

import React from 'react';

const DemoNotice = () => {
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-accent/20 border border-accent rounded-lg px-4 py-2 backdrop-blur-sm">
        <p className="text-accent text-sm font-medium">
          🚀 Modo Demo: Sesión iniciada como <span className="font-bold">Alice</span>
        </p>
      </div>
    </div>
  );
};

export default DemoNotice;
