/**
 * Feed Component - Feed principal de posts
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFeed, setMode, clearFeed } from './feedSlice';
import PostCard from '../posts/PostCard';
import Loader from '../../components/Loader';
import { FiGrid, FiUsers, FiUser } from 'react-icons/fi';

const Feed = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { posts, loading, error, mode } = useSelector((state) => state.feed);

  useEffect(() => {
    if (currentUser && currentUser.username) {
      console.log('📊 Fetching feed for:', currentUser.username, 'mode:', mode);
      dispatch(fetchFeed({ username: currentUser.username, mode }));
    } else {
      console.warn('⚠️ No current user found');
    }
  }, [dispatch, currentUser, mode]);

  const handleModeChange = (newMode) => {
    dispatch(clearFeed());
    dispatch(setMode(newMode));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Feed</h1>
        </div>
        
        {/* Mode Selector */}
        <div className="flex border-b border-dark-border">
          <ModeTab
            icon={<FiGrid />}
            label="Todos"
            active={mode === 'all'}
            onClick={() => handleModeChange('all')}
            testId="mode-all"
          />
          <ModeTab
            icon={<FiUsers />}
            label="Siguiendo"
            active={mode === 'following'}
            onClick={() => handleModeChange('following')}
            testId="mode-following"
          />
          <ModeTab
            icon={<FiUser />}
            label="Mis Posts"
            active={mode === 'self'}
            onClick={() => handleModeChange('self')}
            testId="mode-self"
          />
        </div>
      </div>

      {/* Content */}
      <div>
        {loading && <Loader />}
        
        {error && (
          <div className="p-4">
            <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-lg">
              {error}
            </div>
          </div>
        )}
        
        {!loading && posts.length === 0 && (
          <div className="p-8 text-center text-text-secondary">
            <p>No hay posts para mostrar</p>
            {mode === 'following' && (
              <p className="mt-2 text-sm">Comienza siguiendo a otros usuarios</p>
            )}
          </div>
        )}
        
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
};

const ModeTab = ({ icon, label, active, onClick, testId }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center space-x-2 py-4 transition-colors ${
        active
          ? 'border-b-4 border-accent text-text-primary'
          : 'text-text-secondary hover:bg-dark-hover'
      }`}
      data-testid={testId}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default Feed;
