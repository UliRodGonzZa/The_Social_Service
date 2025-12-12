/**
 * Feed Component - FIXED: Mejor manejo de errores y UX
 */

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchFeed, setMode, clearFeed, clearError } from "./feedSlice";
import PostCard from "../posts/PostCard";
import Loader from "../../components/Loader";
import { FiGrid, FiUsers, FiUser, FiAlertCircle } from "react-icons/fi";

const Feed = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { posts, loading, error, mode } = useSelector((state) => state.feed);

  // Cargar feed cuando cambie el modo o cuando se limpie (posts.length === 0 después de crear)
  useEffect(() => {
    if (currentUser && currentUser.username) {
      // Solo cargar si no hay posts o si cambió el modo
      if (posts.length === 0 || mode) {
        console.log(
          "📊 Loading feed for:",
          currentUser.username,
          "mode:",
          mode
        );
        dispatch(fetchFeed({ username: currentUser.username, mode }));
      }
    } else {
      console.warn("⚠️ No current user found");
    }
  }, [dispatch, currentUser, mode, posts.length]);

  const handleModeChange = (newMode) => {
    dispatch(clearFeed());
    dispatch(setMode(newMode));
  };

  const handleRetry = () => {
    dispatch(clearError());
    if (currentUser && currentUser.username) {
      dispatch(fetchFeed({ username: currentUser.username, mode }));
    }
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
            active={mode === "all"}
            onClick={() => handleModeChange("all")}
            testId="mode-all"
          />
          <ModeTab
            icon={<FiUsers />}
            label="Siguiendo"
            active={mode === "following"}
            onClick={() => handleModeChange("following")}
            testId="mode-following"
          />
          <ModeTab
            icon={<FiUser />}
            label="Mis Posts"
            active={mode === "self"}
            onClick={() => handleModeChange("self")}
            testId="mode-self"
          />
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Loading State */}
        {loading && <Loader />}

        {/* Error State - SOLO SI HAY ERROR Y NO ESTAMOS CARGANDO */}
        {!loading && error && (
          <div className="p-4">
            <div className="card p-6">
              <div className="flex items-start space-x-3">
                <FiAlertCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold mb-2">Error al cargar el feed</h3>
                  <p className="text-text-secondary text-sm mb-4">{error}</p>
                  <button onClick={handleRetry} className="btn-primary">
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - SOLO SI NO HAY ERROR */}
        {!loading && !error && posts.length === 0 && (
          <div className="p-8 text-center">
            <div className="card p-8">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-xl font-bold mb-2">
                No hay posts para mostrar
              </h2>
              <p className="text-text-secondary">
                {mode === "following" && "Comienza siguiendo a otros usuarios"}
                {mode === "self" &&
                  "Crea tu primer post usando el formulario de arriba"}
                {mode === "all" && "Sé el primero en publicar algo"}
              </p>
            </div>
          </div>
        )}

        {/* Posts List - SOLO SI HAY POSTS */}
        {!loading && posts.length > 0 && (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
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
          ? "border-b-4 border-accent text-text-primary"
          : "text-text-secondary hover:bg-dark-hover"
      }`}
      data-testid={testId}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default Feed;
