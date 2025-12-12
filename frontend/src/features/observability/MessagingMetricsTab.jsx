/**
 * MessagingMetricsTab - Sprint 2: Métricas de Mensajería
 * 
 * Muestra:
 * - Tasa de mensajes (por minuto/segundo)
 * - Presencia de usuarios (online, typing)
 * - Mensajes no leídos (por conversación)
 */

import React, { useState, useEffect } from 'react';

const MessagingMetricsTab = ({ mode }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      const response = await fetch(`${baseUrl}/api/observability/messaging/metrics`);
      if (!response.ok) throw new Error('Error obteniendo messaging metrics');
      const data = await response.json();
      setMetrics(data);

    } catch (err) {
      console.error('Error fetching messaging metrics:', err);
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

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary mt-4">Cargando métricas de mensajería...</p>
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

        {metrics && (
          <span className="text-xs text-text-secondary">
            Última actualización: {new Date(metrics.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Rate Metrics */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4">📊 Tasa de Mensajes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Mensajes/Minuto"
            value={metrics?.rate?.messages_per_minute || 0}
            icon="⚡"
            color="blue"
            subtitle="En el último minuto"
          />
          <MetricCard
            title="Mensajes/Segundo"
            value={metrics?.rate?.messages_per_second?.toFixed(2) || '0.00'}
            icon="📈"
            color="green"
            subtitle="Promedio"
          />
          <MetricCard
            title="Total Hoy"
            value={metrics?.rate?.total_messages_today || 0}
            icon="📅"
            color="purple"
            subtitle="Mensajes enviados"
          />
          <MetricCard
            title="Conversaciones Activas"
            value={metrics?.rate?.active_conversations || 0}
            icon="💬"
            color="yellow"
            subtitle="En los últimos 10 min"
          />
        </div>
      </div>

      {/* Presence Metrics */}
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-bold text-text-primary">👥 Presencia y Actividad</h2>
          <p className="text-sm text-text-secondary mt-1">
            Keys: <code className="text-accent">presence:{'{'}userId{'}'}</code> (TTL 30s), 
            <code className="text-accent ml-2">typing:{'{'}chatId{'}'}:{'{'}userId{'}'}</code> (TTL 3s)
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Online Users */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary">
                🟢 Usuarios Online
                <span className="ml-2 text-accent">{metrics?.presence?.total_online || 0}</span>
              </h3>
            </div>

            {metrics?.presence?.users_online?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {metrics.presence.users_online.map((username, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                  >
                    {username}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm">No hay usuarios online</p>
            )}
          </div>

          {/* Typing Users */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary">
                ⌨️ Escribiendo Ahora
                <span className="ml-2 text-accent">{metrics?.presence?.total_typing || 0}</span>
              </h3>
            </div>

            {metrics?.presence?.typing_in_chats && Object.keys(metrics.presence.typing_in_chats).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(metrics.presence.typing_in_chats).map(([chatId, users], idx) => (
                  <div key={idx} className="bg-dark-bg/50 rounded p-3">
                    <p className="text-sm text-text-secondary font-mono mb-1">{chatId}</p>
                    <div className="flex flex-wrap gap-2">
                      {users.map((username, uidx) => (
                        <span
                          key={uidx}
                          className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs"
                        >
                          {username} está escribiendo...
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm">Nadie está escribiendo en este momento</p>
            )}
          </div>
        </div>
      </div>

      {/* Unread Metrics */}
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-bold text-text-primary">📬 Mensajes No Leídos</h2>
          <p className="text-sm text-text-secondary mt-1">
            Keys: <code className="text-accent">unread:{'{'}userId{'}'}</code> (HASH con {'{'}chatId: count{'}'})
          </p>
        </div>

        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <MetricCard
              title="Total No Leídos"
              value={metrics?.unread?.total_unread_messages || 0}
              icon="📨"
              color="red"
            />
            <MetricCard
              title="Usuarios con No Leídos"
              value={metrics?.unread?.users_with_unread || 0}
              icon="👤"
              color="orange"
            />
            <MetricCard
              title="Promedio por Usuario"
              value={metrics?.unread?.average_unread_per_user?.toFixed(1) || '0.0'}
              icon="📊"
              color="blue"
            />
          </div>

          {/* Top Conversations */}
          <div>
            <h3 className="font-semibold text-text-primary mb-3">🔥 Top Conversaciones con Más No Leídos</h3>
            
            {metrics?.unread?.top_conversations?.length > 0 ? (
              <div className="space-y-2">
                {metrics.unread.top_conversations.map((conv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-dark-bg/50 rounded p-3 hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📍'}</span>
                      <span className="font-mono text-sm text-text-secondary">{conv.chat_id}</span>
                    </div>
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full font-semibold">
                      {conv.unread_count} no leídos
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm text-center py-4">
                No hay mensajes no leídos
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Redis Commands Reference */}
      <div className="bg-dark-bg/30 rounded-lg border border-dark-border p-6">
        <h3 className="font-semibold text-text-primary mb-3">📖 Comandos Redis Utilizados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-accent font-semibold mb-2">Rate (Tasa):</p>
            <code className="text-text-secondary">
              INCR msg:rate:{'{'}minute{'}'}<br/>
              EXPIRE msg:rate:{'{'}minute{'}'} 60<br/>
              GET msg:total:{'{'}today{'}'}
            </code>
          </div>
          <div>
            <p className="text-accent font-semibold mb-2">Presence:</p>
            <code className="text-text-secondary">
              SETEX presence:{'{'}userId{'}'} 30 "online"<br/>
              SETEX typing:{'{'}chatId{'}'}:{'{'}userId{'}'} 3 "1"<br/>
              SCAN 0 MATCH presence:*
            </code>
          </div>
          <div>
            <p className="text-accent font-semibold mb-2">Unread:</p>
            <code className="text-text-secondary">
              HINCRBY unread:{'{'}userId{'}'} {'{'}chatId{'}'} 1<br/>
              HGETALL unread:{'{'}userId{'}'}<br/>
              HDEL unread:{'{'}userId{'}'} {'{'}chatId{'}'}
            </code>
          </div>
          <div>
            <p className="text-accent font-semibold mb-2">Active Conversations:</p>
            <code className="text-text-secondary">
              SADD active:conversations {'{'}chatId{'}'}<br/>
              EXPIRE active:conversations 600<br/>
              SCARD active:conversations
            </code>
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
    orange: 'bg-orange-500/10 border-orange-500/30',
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

export default MessagingMetricsTab;
