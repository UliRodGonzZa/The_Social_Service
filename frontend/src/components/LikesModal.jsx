import React, { useState, useEffect } from 'react';
import { FiX, FiHeart } from 'react-icons/fi';

const LikesModal = ({ postId, isOpen, onClose }) => {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && postId) {
      fetchLikes();
    }
  }, [isOpen, postId]);

  const fetchLikes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/posts/${postId}/likes/users`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener likes');
      }
      
      const data = await response.json();
      setLikes(data.users || []);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-card rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col border border-dark-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center space-x-2">
            <FiHeart className="w-5 h-5 text-red-500 fill-current" />
            <h2 className="text-lg font-semibold text-text-primary">
              Likes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchLikes}
                className="mt-4 text-accent hover:underline"
              >
                Reintentar
              </button>
            </div>
          ) : likes.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <FiHeart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aún no hay likes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {likes.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-dark-bg transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">
                      @{user.username}
                    </p>
                    {user.name && (
                      <p className="text-sm text-text-secondary">
                        {user.name}
                      </p>
                    )}
                  </div>

                  {/* Like Icon */}
                  <FiHeart className="w-5 h-5 text-red-500 fill-current" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && likes.length > 0 && (
          <div className="p-4 border-t border-dark-border">
            <p className="text-sm text-text-secondary text-center">
              {likes.length} {likes.length === 1 ? 'persona le dio' : 'personas les dieron'} like
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LikesModal;
