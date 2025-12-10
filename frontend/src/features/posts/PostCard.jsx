/**
 * PostCard - Tarjeta individual de post
 * Muestra contenido, autor, tags, likes, comentarios
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiMessageCircle, FiShare2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const PostCard = ({ post }) => {
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })
    : '';

  return (
    <article className="border-b border-dark-border hover:bg-dark-hover/50 transition-colors" data-testid="post-card">
      <div className="p-4">
        {/* Header - Author info */}
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <Link to={`/profile/${post.author_username}`}>
            <div className="w-12 h-12 bg-accent-dark rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {post.author_username?.charAt(0).toUpperCase()}
              </span>
            </div>
          </Link>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Author & Time */}
            <div className="flex items-center space-x-2">
              <Link
                to={`/profile/${post.author_username}`}
                className="font-bold hover:underline"
                data-testid="post-author"
              >
                {post.author_username}
              </Link>
              <span className="text-text-secondary">@{post.author_username}</span>
              <span className="text-text-secondary">·</span>
              <span className="text-text-secondary text-sm">{timeAgo}</span>
            </div>
            
            {/* Post Content */}
            <p className="mt-2 text-text-primary whitespace-pre-wrap" data-testid="post-content">
              {post.content}
            </p>
            
            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {post.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-accent text-sm hover:underline cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-3 flex items-center space-x-12 text-text-secondary">
              {/* Likes - TODO: Implementar funcionalidad */}
              <button
                className="flex items-center space-x-2 hover:text-danger transition-colors group"
                data-testid="post-like-button"
              >
                <FiHeart className="w-5 h-5 group-hover:fill-danger" />
                <span className="text-sm">0</span>
              </button>
              
              {/* Comments - TODO: Implementar */}
              <button
                className="flex items-center space-x-2 hover:text-accent transition-colors"
                data-testid="post-comment-button"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span className="text-sm">0</span>
              </button>
              
              {/* Share */}
              <button className="flex items-center space-x-2 hover:text-success transition-colors">
                <FiShare2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default PostCard;
