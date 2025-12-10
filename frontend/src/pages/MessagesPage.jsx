/**
 * MessagesPage - Mensajes directos
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Almacenar mensajes {sender, receiver, content, created_at}
 * - Neo4j: Relación (User)-[:MESSAGED]->(User) con timestamp
 * - Redis Cluster: Cache de conversaciones
 *   Key: {conv:alice::bob}:messages
 *   TTL: 300 segundos (5 minutos)
 */

import React from 'react';
import Layout from '../components/Layout';

const MessagesPage = () => {
  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">💬 Mensajes</h1>
            <p className="text-text-secondary text-sm">Conversaciones privadas</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-screen">
          {/* Conversations List */}
          <div className="w-80 border-r border-dark-border">
            <div className="p-4">
              <div className="card p-4 text-center">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-text-secondary text-sm">No hay conversaciones</p>
              </div>
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-text-secondary">
              <div className="text-6xl mb-4">📨</div>
              <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
              <p className="mb-6">Sistema de mensajes directos en tiempo real</p>
              
              <div className="text-left max-w-md mx-auto space-y-3 text-sm">
                <div className="flex items-start space-x-2">
                  <span className="text-accent">✓</span>
                  <span>MongoDB: Almacenar mensajes</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Neo4j: Relaciones (User)-[:MESSAGED]->(User)</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Redis: Cache de conversaciones (TTL 5min)</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-accent">✓</span>
                  <span>WebSockets para mensajes en tiempo real</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
