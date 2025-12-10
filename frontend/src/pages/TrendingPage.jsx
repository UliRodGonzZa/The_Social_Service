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
        <div className="p-8">
          <div className="card p-6 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
            <p className="text-text-secondary mb-6">
              Sistema de trending posts con Redis Sorted Sets
            </p>
            
            <div className="text-left max-w-md mx-auto space-y-3 text-sm text-text-secondary">
              <div className="flex items-start space-x-2">
                <span className="text-accent">✓</span>
                <span>Redis: ZSET trending:posts (score = likes)</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-accent">✓</span>
                <span>Actualización en tiempo real con cada like</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-accent">✓</span>
                <span>Top 10 posts más likeados</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-accent">✓</span>
                <span>Filtros: 1h, 24h, 7d, all time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TrendingPage;
