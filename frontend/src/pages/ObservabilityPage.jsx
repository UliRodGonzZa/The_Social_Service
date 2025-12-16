/**
 * ObservabilityPage - Dashboard de Observabilidad de Redis Cluster
 * 
 * Dashboard para monitorear el estado y métricas del Redis Cluster.
 * 
 * Tabs:
 * 1. Cluster Health - Topología, nodos, estado, métricas por nodo
 * 2. Messaging Metrics - Mensajes/min, presencia, unread (Sprint 2)
 * 3. Data Distribution - Mapeo chatId → slot → master (Sprint 3)
 */

import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ClusterHealthTab from '../features/observability/ClusterHealthTab';

const ObservabilityPage = () => {
  const [activeTab, setActiveTab] = useState('health'); // 'health', 'messaging', 'distribution'
  const [mode, setMode] = useState('loading'); // 'mock' | 'production' | 'loading'

  useEffect(() => {
    // Obtener modo de observabilidad
    const fetchMode = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/observability/mode`);
        const data = await response.json();
        setMode(data.mode);
      } catch (error) {
        console.error('Error obteniendo modo:', error);
        setMode('mock'); // Fallback a mock
      }
    };
    fetchMode();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-dark-bg">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  📊 Observabilidad Redis Cluster
                </h1>
                <p className="text-sm text-text-secondary mt-1">
                  Monitoreo en tiempo real del cluster NoSQL
                </p>
              </div>
              
              {/* Badge de modo */}
              <div className="flex items-center space-x-3">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  mode === 'production' 
                    ? 'bg-green-500/20 text-green-400' 
                    : mode === 'mock'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {mode === 'production' ? '🟢 PRODUCTION' : mode === 'mock' ? '🟡 MOCK/DEMO' : '⏳ CARGANDO'}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 mt-6 border-b border-dark-border">
              <button
                onClick={() => setActiveTab('health')}
                className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'health'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
                data-testid="tab-cluster-health"
              >
                🏥 Cluster Health
              </button>
              
              <button
                onClick={() => setActiveTab('messaging')}
                className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'messaging'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
                data-testid="tab-messaging-metrics"
                disabled
              >
                💬 Messaging Metrics
                <span className="ml-2 text-xs text-text-secondary">(Sprint 2)</span>
              </button>
              
              <button
                onClick={() => setActiveTab('distribution')}
                className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'distribution'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
                data-testid="tab-data-distribution"
                disabled
              >
                🗺️ Data Distribution
                <span className="ml-2 text-xs text-text-secondary">(Sprint 3)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {activeTab === 'health' && <ClusterHealthTab mode={mode} />}
          {activeTab === 'messaging' && (
            <div className="text-center py-20 text-text-secondary">
              <p className="text-lg">💬 Messaging Metrics</p>
              <p className="text-sm mt-2">Coming in Sprint 2</p>
            </div>
          )}
          {activeTab === 'distribution' && (
            <div className="text-center py-20 text-text-secondary">
              <p className="text-lg">🗺️ Data Distribution</p>
              <p className="text-sm mt-2">Coming in Sprint 3</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ObservabilityPage;
