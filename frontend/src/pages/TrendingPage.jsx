/**
 * TrendingPage - Posts trending (más populares)
 * FUNCIONAL con Redis Sorted Sets
 */

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PostCard from '../features/posts/PostCard';
import Loader from '../components/Loader';
import { postsAPI } from '../services/api';

const TrendingPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const response = await postsAPI.getTrendingPosts(10);
        setPosts(response.data);
        console.log('📈 Trending posts loaded:', response.data.length);
      } catch (error) {
        console.error('Error loading trending:', error);
        setError('Error al cargar trending posts');
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">📈 Trending</h1>
            <p className="text-text-secondary text-sm">Posts más populares</p>
          </div>
        </div>

        {/* Content */}
        <div>
          {loading && <Loader text="Cargando trending posts..." />}
          
          {!loading && error && (
            <div className="p-4">
              <div className="card p-6 text-center">
                <p className="text-danger">{error}</p>
              </div>
            </div>
          )}
          
          {!loading && !error && posts.length === 0 && (
            <div className="p-8">
              <div className="card p-6 text-center">
                <div className="text-6xl mb-4">🔥</div>
                <h2 className="text-2xl font-bold mb-2">No hay trending posts</h2>
                <p className="text-text-secondary mb-6">
                  ¡Sé el primero en dar likes a los posts!
                </p>
                <p className="text-sm text-text-secondary">
                  Los posts con más likes aparecerán aquí en tiempo real
                  gracias a Redis Sorted Sets
                </p>
              </div>
            </div>
          )}
          
          {!loading && posts.length > 0 && (
            <div>
              {posts.map((post, index) => (
                <div key={post.id} className="relative">
                  {/* Badge de ranking */}
                  <div className="absolute left-2 top-6 z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-dark-border text-text-secondary'
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                  <div className="pl-8">
                    <PostCard post={post} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TrendingPage;
