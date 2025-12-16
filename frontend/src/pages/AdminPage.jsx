import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [topPosters, setTopPosters] = useState([]);
  const [postsByDay, setPostsByDay] = useState([]);
  const [dmStats, setDmStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all admin endpoints in parallel
      const [summaryRes, postersRes, byDayRes, dmStatsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats/summary`),
        fetch(`${API_URL}/api/admin/stats/users/top-posters?limit=10`),
        fetch(`${API_URL}/api/admin/stats/posts/by-day?days=7`),
        fetch(`${API_URL}/api/admin/stats/dms/summary`)
      ]);

      if (!summaryRes.ok) throw new Error('Error al obtener resumen');
      if (!postersRes.ok) throw new Error('Error al obtener top posters');
      if (!byDayRes.ok) throw new Error('Error al obtener posts por día');
      if (!dmStatsRes.ok) throw new Error('Error al obtener stats de DMs');

      const [summaryData, postersData, byDayData, dmStatsData] = await Promise.all([
        summaryRes.json(),
        postersRes.json(),
        byDayRes.json(),
        dmStatsRes.json()
      ]);

      setSummary(summaryData);
      setTopPosters(postersData);
      setPostsByDay(byDayData);
      setDmStats(dmStatsData);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState('overview');

  if (loading) {
    return (
      <div className="flex">
        <Navbar />
        <div className="flex-1 ml-64 flex items-center justify-center min-h-screen bg-dark-bg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
            <p className="mt-4 text-text-secondary">Cargando estadísticas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex">
        <Navbar />
        <div className="flex-1 ml-64 flex items-center justify-center min-h-screen bg-dark-bg">
          <div className="bg-dark-card p-6 rounded-lg max-w-md w-full border border-dark-border">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={fetchAdminStats}
              className="w-full bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-dark-bg min-h-screen">
      <Navbar />
      <div className="flex-1 ml-64">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Panel de Administrador</h1>
            <p className="text-text-secondary">Métricas y estadísticas de la aplicación</p>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-dark-card p-1 rounded-lg border border-dark-border">
              {['overview', 'users', 'posts', 'messages'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {tab === 'overview' && 'Resumen'}
                  {tab === 'users' && 'Usuarios'}
                  {tab === 'posts' && 'Posts'}
                  {tab === 'messages' && 'Mensajes'}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Total Usuarios</h3>
                  <div className="text-3xl font-bold text-white">{summary?.total_users || 0}</div>
                  <p className="text-xs text-text-secondary mt-2">
                    {summary?.active_users_last_7d || 0} activos últimos 7 días
                  </p>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Total Posts</h3>
                  <div className="text-3xl font-bold text-white">{summary?.total_posts || 0}</div>
                  <p className="text-xs text-text-secondary mt-2">
                    {summary?.posts_last_7d || 0} posts últimos 7 días
                  </p>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Total Mensajes</h3>
                  <div className="text-3xl font-bold text-white">{summary?.total_dms || 0}</div>
                  <p className="text-xs text-text-secondary mt-2">
                    {summary?.dms_last_7d || 0} mensajes últimos 7 días
                  </p>
                </div>
              </div>

              <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                <h3 className="text-lg font-bold text-white mb-4">Actividad Reciente</h3>
                <p className="text-text-secondary text-sm mb-4">Métricas de los últimos 7 días</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Usuarios Activos</p>
                      <p className="text-xs text-text-secondary">Usuarios que publicaron o enviaron mensajes</p>
                    </div>
                    <span className="text-2xl font-bold text-accent">{summary?.active_users_last_7d || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-dark-bg rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Engagement Rate</p>
                      <p className="text-xs text-text-secondary">Posts + Mensajes por usuario activo</p>
                    </div>
                    <span className="text-2xl font-bold text-accent">
                      {summary?.active_users_last_7d > 0 
                        ? ((summary?.posts_last_7d + summary?.dms_last_7d) / summary?.active_users_last_7d).toFixed(1)
                        : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
              <h3 className="text-lg font-bold text-white mb-4">Top Usuarios por Posts</h3>
              <p className="text-text-secondary text-sm mb-4">Usuarios con más publicaciones</p>
              {topPosters.length === 0 ? (
                <p className="text-text-secondary text-center py-4">No hay datos disponibles</p>
              ) : (
                <div className="space-y-3">
                  {topPosters.map((poster, index) => (
                    <div key={poster.username} className="flex items-center space-x-4 p-3 bg-dark-bg rounded-lg">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        index === 0 ? 'bg-yellow-500 text-dark-bg' :
                        index === 1 ? 'bg-gray-400 text-dark-bg' :
                        index === 2 ? 'bg-orange-500 text-dark-bg' :
                        'bg-accent text-white'
                      } font-bold text-lg`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">@{poster.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-accent">{poster.posts_count}</p>
                        <p className="text-xs text-text-secondary">posts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
              <h3 className="text-lg font-bold text-white mb-4">Posts por Día</h3>
              <p className="text-text-secondary text-sm mb-4">Últimos 7 días</p>
              {postsByDay.length === 0 ? (
                <p className="text-text-secondary text-center py-4">No hay datos disponibles</p>
              ) : (
                <div className="space-y-2">
                  {postsByDay.map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                      <span className="font-medium text-white">{day.date}</span>
                      <div className="flex items-center space-x-3">
                        <div className="h-3 bg-accent rounded" style={{ width: `${Math.max(day.count * 30, 20)}px` }}></div>
                        <span className="font-bold text-accent text-lg">{day.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Total Mensajes</h3>
                  <div className="text-3xl font-bold text-white">{dmStats?.total_dms || 0}</div>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Mensajes No Leídos</h3>
                  <div className="text-3xl font-bold text-red-500">{dmStats?.unread_dms || 0}</div>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Usuarios con DMs</h3>
                  <div className="text-3xl font-bold text-white">{dmStats?.users_with_dms || 0}</div>
                </div>
              </div>

              <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                <h3 className="text-lg font-bold text-white mb-4">Estadísticas de Mensajería</h3>
                <p className="text-text-secondary text-sm mb-4">Análisis de la actividad de mensajes directos</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
                    <div>
                      <p className="font-medium text-white">Mensajes Leídos</p>
                      <p className="text-sm text-text-secondary">Porcentaje de mensajes leídos</p>
                    </div>
                    <span className="text-2xl font-bold text-blue-400">
                      {dmStats?.total_dms > 0 
                        ? (((dmStats?.total_dms - dmStats?.unread_dms) / dmStats?.total_dms) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg border border-green-700/50">
                    <div>
                      <p className="font-medium text-white">Promedio de Mensajes</p>
                      <p className="text-sm text-text-secondary">Por usuario con actividad</p>
                    </div>
                    <span className="text-2xl font-bold text-green-400">
                      {dmStats?.users_with_dms > 0 
                        ? (dmStats?.total_dms / dmStats?.users_with_dms).toFixed(1)
                        : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={fetchAdminStats}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
            >
              Actualizar Estadísticas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
