/**
 * ClusterHealthTab - Tab de salud del cluster
 * 
 * Muestra:
 * - Estado general del cluster (CLUSTER INFO)
 * - Topología de nodos (CLUSTER NODES)
 * - Métricas por nodo (INFO)
 * - Distribución de slots (CLUSTER SLOTS)
 */

import React, { useState, useEffect } from 'react';

const ClusterHealthTab = ({ mode }) => {
  const [health, setHealth] = useState(null);
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      // Fetch cluster health
      const healthResponse = await fetch(`${baseUrl}/api/observability/cluster/health`);
      if (!healthResponse.ok) throw new Error('Error obteniendo cluster health');
      const healthData = await healthResponse.json();
      setHealth(healthData);

      // Fetch cluster slots
      const slotsResponse = await fetch(`${baseUrl}/api/observability/cluster/slots`);
      if (!slotsResponse.ok) throw new Error('Error obteniendo cluster slots');
      const slotsData = await slotsResponse.json();
      setSlots(slotsData);

    } catch (err) {
      console.error('Error fetching observability data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh cada 5 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary mt-4">Cargando métricas del cluster...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
        <p className="text-red-400 font-semibold">❌ Error</p>
        <p className="text-text-secondary mt-2">{error}</p>
        <button onClick={fetchData} className="btn-primary mt-4">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary text-sm"
            data-testid="refresh-button"
          >
            🔄 Refrescar
          </button>
          
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-text-secondary">Auto-refresh (5s)</span>
          </label>
        </div>

        {health && (
          <span className="text-xs text-text-secondary">
            Última actualización: {new Date(health.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Cluster Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Estado del Cluster"
          value={health?.cluster_state || 'unknown'}
          icon="🏥"
          color={health?.cluster_state === 'ok' ? 'green' : 'red'}
        />
        <MetricCard
          title="Nodos Conocidos"
          value={health?.cluster_known_nodes || 0}
          subtitle={`${health?.cluster_size || 0} masters`}
          icon="🖥️"
          color="blue"
        />
        <MetricCard
          title="Slots Asignados"
          value={health?.cluster_slots_assigned || 0}
          subtitle={`de 16384 total`}
          icon="🎯"
          color="purple"
        />
        <MetricCard
          title="Slots OK"
          value={health?.cluster_slots_ok || 0}
          subtitle={`${health?.cluster_slots_fail || 0} fails`}
          icon="✅"
          color={health?.cluster_slots_fail === 0 ? 'green' : 'yellow'}
        />
      </div>

      {/* Nodes Table */}
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-bold text-text-primary">📍 Topología de Nodos</h2>
          <p className="text-sm text-text-secondary mt-1">
            Comando: <code className="text-accent">CLUSTER NODES</code>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-bg/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Nodo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Slots
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Memoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Ops/sec
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Clientes
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                  Uptime
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {health?.nodes?.map((node) => (
                <tr key={node.node_id} className="hover:bg-dark-hover transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{node.ip_port}</p>
                      <p className="text-xs text-text-secondary font-mono">{node.node_id.substring(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                      node.role === 'master'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {node.role === 'master' ? '👑 Master' : '🔄 Replica'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                      node.state === 'connected'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {node.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary font-mono">
                    {node.slots === '-' ? '-' : node.slots.length > 20 ? node.slots.substring(0, 20) + '...' : node.slots}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary">
                    {node.used_memory_human || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary">
                    {node.instantaneous_ops_per_sec || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-primary">
                    {node.connected_clients || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {formatUptime(node.uptime_in_seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slots Distribution */}
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-bold text-text-primary">🎯 Distribución de Slots</h2>
          <p className="text-sm text-text-secondary mt-1">
            Comando: <code className="text-accent">CLUSTER SLOTS</code>
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {slots?.slot_distributions?.map((dist, idx) => (
              <div key={idx} className="bg-dark-bg/50 rounded-lg p-4 border border-dark-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">👑</span>
                      <div>
                        <p className="font-semibold text-text-primary">{dist.master_ip_port}</p>
                        <p className="text-xs text-text-secondary font-mono">{dist.master_node.substring(0, 12)}...</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div>
                        <span className="text-text-secondary">Slots: </span>
                        <span className="text-accent font-mono">{dist.slot_range}</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Replicas: </span>
                        <span className="text-text-primary">{dist.replicas.length}</span>
                      </div>
                    </div>

                    {dist.replicas.length > 0 && (
                      <div className="mt-3 pl-8 border-l-2 border-dark-border">
                        {dist.replicas.map((replicaId, ridx) => (
                          <div key={ridx} className="flex items-center space-x-2 text-sm text-text-secondary">
                            <span>🔄</span>
                            <span className="font-mono">{replicaId.substring(0, 12)}...</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visual representation of slot coverage */}
                  <div className="text-right">
                    <div className="text-xs text-text-secondary mb-1">Cobertura</div>
                    <div className="text-2xl font-bold text-accent">
                      {calculateSlotPercentage(dist.slot_range)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const MetricCard = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    green: 'bg-green-500/10 border-green-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    red: 'bg-red-500/10 border-red-500/30',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-secondary mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
};

// Helper Functions
const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
};

const calculateSlotPercentage = (slotRange) => {
  if (!slotRange || slotRange === '-') return 0;
  const [start, end] = slotRange.split('-').map(Number);
  const coverage = ((end - start + 1) / 16384) * 100;
  return coverage.toFixed(1);
};

export default ClusterHealthTab;
