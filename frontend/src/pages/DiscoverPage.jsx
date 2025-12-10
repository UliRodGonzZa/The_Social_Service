/**
 * DiscoverPage - Descubrir usuarios y recomendaciones
 * 
 * INTEGRACIÓN NOSQL:
 * - Neo4j: Algoritmo "amigos de amigos" (2-hop traversal)
 *   MATCH (u:User {id})-[:FOLLOWS]->()-[:FOLLOWS]->(suggestion)
 *   WHERE NOT (u)-[:FOLLOWS]->(suggestion)
 *   RETURN suggestion, COUNT(*) as mutual_connections
 * 
 * - Redis Cluster: Cache de sugerencias
 *   Key: {user:alice}:suggestions
 *   TTL: 600 segundos (10 minutos)
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import { fetchSuggestions } from '../features/users/usersSlice';
import Loader from '../components/Loader';

const DiscoverPage = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { suggestions, loading } = useSelector((state) => state.users);

  useEffect(() => {
    if (currentUser && currentUser.username) {
      dispatch(fetchSuggestions(currentUser.username));
    }
  }, [dispatch, currentUser]);

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">👥 Descubrir</h1>
            <p className="text-text-secondary text-sm">Usuarios sugeridos para ti</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && <Loader text="Buscando usuarios..." />}
          
          {!loading && suggestions.length === 0 && (
            <div className="card p-8 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-bold mb-2">No hay sugerencias</h2>
              <p className="text-text-secondary">
                Sigue a más usuarios para recibir recomendaciones personalizadas
              </p>
            </div>
          )}
          
          {!loading && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((user) => (
                <UserCard key={user.username} user={user} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const UserCard = ({ user }) => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const [following, setFollowing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleFollow = async () => {
    if (!currentUser || !currentUser.username) return;
    
    setLoading(true);
    try {
      const result = await dispatch(
        followUser({
          username: currentUser.username,
          targetUsername: user.username,
        })
      );
      
      if (result.type === 'users/followUser/fulfilled') {
        setFollowing(true);
        console.log('✅ Ahora sigues a', user.username);
      }
    } catch (error) {
      console.error('❌ Error al seguir:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 hover:bg-dark-hover transition-colors">
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="w-12 h-12 bg-accent-dark rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">
            {user.username?.charAt(0).toUpperCase()}
          </span>
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{user.username}</p>
              {user.mutual_connections > 0 && (
                <p className="text-text-secondary text-sm">
                  {user.mutual_connections} conexiones mutuas
                </p>
              )}
            </div>
            <button
              onClick={handleFollow}
              disabled={loading || following}
              className={following ? "btn-secondary" : "btn-primary"}
            >
              {loading ? 'Siguiendo...' : following ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
          {user.bio && (
            <p className="text-text-secondary text-sm mt-2">{user.bio}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
