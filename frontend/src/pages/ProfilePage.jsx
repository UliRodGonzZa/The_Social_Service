/**
 * ProfilePage - Perfil de usuario
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Datos del usuario, posts propios
 * - Neo4j: Conteo de seguidores/seguidos
 *   MATCH (u:User {id})<-[:FOLLOWS]-(follower) RETURN COUNT(follower)
 *   MATCH (u:User {id})-[:FOLLOWS]->(following) RETURN COUNT(following)
 * - Redis: NO se usa (perfil cambia poco)
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../components/Layout';

const ProfilePage = () => {
  const { username } = useParams();
  const { currentUser } = useSelector((state) => state.auth);
  const isOwnProfile = currentUser?.username === username;

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
                <h2 className="text-2xl font-bold">{currentUser?.name || username}</h2>
                <p className="text-text-secondary">@{username}</p>
              </div>
              {!isOwnProfile && (
                <button className="btn-primary">Seguir</button>
              )}
            </div>
            
            {currentUser?.bio && (
              <p className="text-text-primary mb-4">{currentUser.bio}</p>
            )}
            
            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="font-bold text-text-primary">0</span>
                <span className="text-text-secondary ml-1">Siguiendo</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">0</span>
                <span className="text-text-secondary ml-1">Seguidores</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">2</span>
                <span className="text-text-secondary ml-1">Posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="p-8 text-center text-text-secondary">
          <p>Posts del usuario próximamente</p>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
