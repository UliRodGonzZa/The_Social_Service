import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, FileText, MessageSquare, TrendingUp, Calendar, Activity } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={fetchAdminStats}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Administrador</h1>
        <p className="text-gray-600">Métricas y estadísticas de la aplicación</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_users || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.active_users_last_7d || 0} activos últimos 7 días
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_posts || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.posts_last_7d || 0} posts últimos 7 días
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_dms || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.dms_last_7d || 0} mensajes últimos 7 días
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Métricas de los últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-green-600 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Usuarios Activos</p>
                    <p className="text-xs text-gray-500">Usuarios que publicaron o enviaron mensajes</p>
                  </div>
                  <span className="text-2xl font-bold">{summary?.active_users_last_7d || 0}</span>
                </div>
                
                <div className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-blue-600 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Engagement Rate</p>
                    <p className="text-xs text-gray-500">Posts + Mensajes por usuario activo</p>
                  </div>
                  <span className="text-2xl font-bold">
                    {summary?.active_users_last_7d > 0 
                      ? ((summary?.posts_last_7d + summary?.dms_last_7d) / summary?.active_users_last_7d).toFixed(1)
                      : 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Usuarios por Posts</CardTitle>
              <CardDescription>Usuarios con más publicaciones</CardDescription>
            </CardHeader>
            <CardContent>
              {topPosters.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>
              ) : (
                <div className="space-y-3">
                  {topPosters.map((poster, index) => (
                    <div key={poster.username} className="flex items-center space-x-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      } font-bold text-sm`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">@{poster.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{poster.posts_count}</p>
                        <p className="text-xs text-gray-500">posts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Posts por Día</CardTitle>
              <CardDescription>Últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              {postsByDay.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>
              ) : (
                <div className="space-y-2">
                  {postsByDay.map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">{day.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="h-2 bg-blue-600 rounded" style={{ width: `${day.count * 20}px` }}></div>
                        <span className="font-bold text-blue-600">{day.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dmStats?.total_dms || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensajes No Leídos</CardTitle>
                <MessageSquare className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{dmStats?.unread_dms || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios con DMs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dmStats?.users_with_dms || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Estadísticas de Mensajería</CardTitle>
              <CardDescription>Análisis de la actividad de mensajes directos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium">Mensajes Leídos</p>
                    <p className="text-sm text-gray-600">Porcentaje de mensajes leídos</p>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    {dmStats?.total_dms > 0 
                      ? (((dmStats?.total_dms - dmStats?.unread_dms) / dmStats?.total_dms) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium">Promedio de Mensajes</p>
                    <p className="text-sm text-gray-600">Por usuario con actividad</p>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {dmStats?.users_with_dms > 0 
                      ? (dmStats?.total_dms / dmStats?.users_with_dms).toFixed(1)
                      : 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-center">
        <button
          onClick={fetchAdminStats}
          className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Actualizar Estadísticas
        </button>
      </div>
    </div>
  );
}

export default AdminPage;
