/**
 * CreatePost - Formulario para crear nuevo post
 */

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createPost } from "./postsSlice";
import { clearFeed } from "../feed/feedSlice";
import { FiImage, FiSmile } from "react-icons/fi";

const CreatePost = () => {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { loading } = useSelector((state) => state.posts);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    console.log("📝 Creating post:", {
      author_username: currentUser.username,
      content: content.trim(),
      tags: tagsArray,
    });

    const result = await dispatch(
      createPost({
        author_username: currentUser.username,
        content: content.trim(),
        tags: tagsArray.length > 0 ? tagsArray : null,
      })
    );

    if (result.type === "posts/createPost/fulfilled") {
      console.log("✅ Post created successfully");
      setContent("");
      setTags("");

      // Recargar el feed automáticamente
      dispatch(clearFeed());
      // El useEffect en Feed.jsx detectará el cambio y recargará
    } else if (result.type === "posts/createPost/rejected") {
      console.error("❌ Failed to create post:", result.payload);
      alert(
        "Error al crear el post: " + (result.payload || "Error desconocido")
      );
    }
  };

  return (
    <div
      className="border-b border-dark-border p-4"
      data-testid="create-post-form"
    >
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="w-12 h-12 bg-accent-dark rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">
            {currentUser?.username?.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1">
          {/* Content Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="¿Qué está pasando?"
            className="w-full bg-transparent text-text-primary text-lg placeholder-text-secondary focus:outline-none resize-none"
            rows="3"
            disabled={loading}
            data-testid="create-post-content"
          />

          {/* Tags Input */}
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separados por coma)"
            className="w-full bg-transparent text-text-secondary text-sm placeholder-text-secondary focus:outline-none border-t border-dark-border pt-2 mt-2"
            disabled={loading}
            data-testid="create-post-tags"
          />

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-border">
            {/* Icons (future: image upload, emojis) */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="p-2 hover:bg-accent/10 text-accent rounded-full transition-colors"
                disabled
                title="Próximamente"
              >
                <FiImage className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 hover:bg-accent/10 text-accent rounded-full transition-colors"
                disabled
                title="Próximamente"
              >
                <FiSmile className="w-5 h-5" />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="btn-primary"
              data-testid="create-post-submit"
            >
              {loading ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePost;
