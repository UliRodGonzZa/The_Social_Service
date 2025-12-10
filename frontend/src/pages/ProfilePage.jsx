/**
 * ProfilePage - Perfil de usuario
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Datos del usuario, posts propios
 * - Neo4j: Conteo de seguidores/seguidos
 * - Redis: Caché de posts del usuario
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Layout from '../components/Layout';
import PostCard from '../features/posts/PostCard';
import { 
  fetchUserProfile, 
  fetchUserPosts, 
  fetchFollowing,
  followUser,
  clearProfile 
} from '../features/profile/profileSlice';
import Loader from '../components/Loader';

const ProfilePage = () => {
  const { username } = useParams();
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { profileUser, userPosts, following, loading, error } = useSelector((state) => state.profile);
  
  const [activeTab, setActiveTab] = useState('posts');
  const isOwnProfile = currentUser?.username === username;
  const isFollowing = following.some(u => u.username === username);

  useEffect(() => {
    // Limpiar perfil anterior
    dispatch(clearProfile());
    
    // Cargar datos del perfil
    dispatch(fetchUserProfile(username));
    dispatch(fetchUserPosts(username));
    
    // Si está autenticado, cargar a quién sigue el usuario actual
    if (currentUser?.username) {
      dispatch(fetchFollowing(currentUser.username));
    }
  }, [dispatch, username, currentUser]);

  const handleFollow = async () => {
    if (!currentUser?.username) return;
    
    await dispatch(followUser({
      currentUsername: currentUser.username,
      targetUsername: username
    }));
    
    // Recargar following
    dispatch(fetchFollowing(currentUser.username));
  };

  if (loading && !profileUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader />
        </div>
      </Layout>
    );
  }

  if (error && !profileUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-danger text-lg mb-4">{error}</p>
            <p className="text-text-secondary">Usuario no encontrado</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">Perfil</h1>
          </div>
        </div>

        {/* Profile Header */}
        <div className="relative">
          {/* Cover */}
          <div className="h-48 bg-gradient-to-r from-accent-dark to-accent"></div>
          
          {/* Avatar */}
          <div className="px-4 -mt-16 mb-4">
            <div className="w-32 h-32 bg-dark-card border-4 border-dark-bg rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-4xl">
                {username?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="px-4 pb-4 border-b border-dark-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{profileUser?.name || username}</h2>
                <p className="text-text-secondary">@{username}</p>
              </div>
              {!isOwnProfile && (
                <button 
                  onClick={handleFollow}
                  disabled={loading || isFollowing}
                  className={isFollowing ? "btn-secondary" : "btn-primary"}
                >
                  {isFollowing ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
            </div>
            
            {profileUser?.bio && (
              <p className="text-text-primary mb-4">{profileUser.bio}</p>
            )}
            
            {profileUser?.email && (
              <p className="text-text-secondary text-sm mb-4">📧 {profileUser.email}</p>
            )}
            
            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div className="cursor-pointer hover:underline">
                <span className="font-bold text-text-primary">{following.length}</span>
                <span className="text-text-secondary ml-1">Siguiendo</span>
              </div>
              <div className="cursor-pointer hover:underline">
                <span className="font-bold text-text-primary">0</span>
                <span className="text-text-secondary ml-1">Seguidores</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">{userPosts.length}</span>
                <span className="text-text-secondary ml-1">Posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-border">
          <div className="flex">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-4 px-4 font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:bg-dark-hover'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-4 px-4 font-medium transition-colors ${
                activeTab === 'media'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:bg-dark-hover'
              }`}
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab('likes')}
              className={`flex-1 py-4 px-4 font-medium transition-colors ${
                activeTab === 'likes'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:bg-dark-hover'
              }`}
            >
              Likes
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'posts' && (
          <div>
            {userPosts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-secondary">
                  {isOwnProfile 
                    ? 'Aún no has publicado nada. ¡Comparte tu primer post!' 
                    : `@${username} aún no ha publicado nada.`
                  }
                </p>
              </div>
            ) : (
              <div>
                {userPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="p-8 text-center text-text-secondary">
            <p>Próximamente: Media del usuario</p>
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="p-8 text-center text-text-secondary">
            <p>Próximamente: Posts que le gustaron</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProfilePage;
