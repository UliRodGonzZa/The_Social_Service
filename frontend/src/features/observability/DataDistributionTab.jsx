/**
 * DataDistributionTab - Sprint 3: Mapeo chatId → slot → master node
 * 
 * Permite a los usuarios ver cómo Redis distribuye las claves de chat
 * en el cluster usando consistent hashing.
 */

import React, { useState } from 'react';
import { Search, Database, Server, Hash } from 'lucide-react';

const DataDistributionTab = ({ mode }) => {
  const [chatId, setChatId] = useState('');
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookupDistribution = async () => {
    if (!chatId.trim()) {
      setError('Por favor ingresa un Chat ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/observability/cluster/distribution?chat_id=${encodeURIComponent(chatId)}`
      );

      if (!response.ok) {
        throw new Error('Error al obtener distribución');
      }

      const data = await response.json();
      setDistributionData(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      lookupDistribution();
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Badge */}
      <div className="flex justify-end">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          mode === 'mock' 
            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50' 
            : 'bg-green-900/30 text-green-400 border border-green-700/50'
        }`}>
          {mode === 'mock' ? '🔸 Modo Mock' : '🔴 Producción'}
        </span>
      </div>

      {/* Search Section */}
      <div className="bg-dark-card rounded-lg border border-dark-border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-text-primary">Buscar Distribución de Chat</h2>
        </div>
        
        <p className="text-text-secondary text-sm mb-4">
          Ingresa un Chat ID para ver en qué slot y nodo master se almacena
        </p>

        <div className="flex space-x-3">
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ej: chat:alice::bob"
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-text-primary 
                     placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={lookupDistribution}
            disabled={loading}
            className="px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium 
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <p className="text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* Results Section */}
      {distributionData && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Chat ID Card */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center space-x-2 mb-3">
              <Hash className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-text-secondary">Chat ID</h3>
            </div>
            <p className="text-2xl font-bold text-text-primary break-all">
              {distributionData.chat_id}
            </p>
          </div>

          {/* Slot Card */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center space-x-2 mb-3">
              <Database className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-semibold text-text-secondary">Hash Slot</h3>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {distributionData.slot}
            </p>
            <p className="text-xs text-text-secondary mt-2">
              Rango: 0-16383
            </p>
          </div>

          {/* Master Node Card */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center space-x-2 mb-3">
              <Server className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-semibold text-text-secondary">Nodo Master</h3>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {distributionData.master_node}
            </p>
            <p className="text-xs text-text-secondary mt-2">
              {distributionData.master_host}:{distributionData.master_port}
            </p>
          </div>
        </div>
      )}

      {/* Explanation Section */}
      {distributionData && (
        <div className="bg-dark-card rounded-lg border border-dark-border p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">
            📚 Cómo funciona la distribución
          </h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <div className="flex items-start space-x-3">
              <span className="text-accent font-bold">1.</span>
              <p>
                Redis calcula un <span className="text-text-primary font-semibold">hash CRC16</span> del 
                Chat ID: <code className="bg-dark-bg px-2 py-1 rounded text-accent">{distributionData.chat_id}</code>
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-accent font-bold">2.</span>
              <p>
                El hash se mapea a un <span className="text-text-primary font-semibold">slot</span> (0-16383): 
                <code className="bg-dark-bg px-2 py-1 rounded text-purple-400 ml-2">{distributionData.slot}</code>
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-accent font-bold">3.</span>
              <p>
                El slot está asignado al nodo master: 
                <code className="bg-dark-bg px-2 py-1 rounded text-green-400 ml-2">{distributionData.master_node}</code>
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-accent font-bold">4.</span>
              <p>
                Todos los datos de este chat se almacenan en: 
                <code className="bg-dark-bg px-2 py-1 rounded text-text-primary ml-2">
                  {distributionData.master_host}:{distributionData.master_port}
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      {!distributionData && !error && (
        <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            💡 Acerca de Data Distribution
          </h3>
          <div className="text-sm text-text-secondary space-y-2">
            <p>
              Redis Cluster divide sus 16,384 slots entre los nodos master del cluster usando 
              <span className="text-text-primary font-semibold"> consistent hashing</span>.
            </p>
            <p>
              Cada clave (como un Chat ID) se mapea a un slot específico, garantizando que siempre 
              vaya al mismo nodo master. Esto permite:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
              <li>Distribución uniforme de datos</li>
              <li>Escalabilidad horizontal</li>
              <li>Failover automático (si un master cae, su replica toma su lugar)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataDistributionTab;
