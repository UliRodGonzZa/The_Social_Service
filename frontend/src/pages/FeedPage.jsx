/**
 * FeedPage - Página principal del feed
 * Combina CreatePost + Feed
 */

import React from 'react';
import Layout from '../components/Layout';
import CreatePost from '../features/posts/CreatePost';
import Feed from '../features/feed/Feed';

const FeedPage = () => {
  return (
    <Layout showSidebar={false}>
      <CreatePost />
      <Feed />
    </Layout>
  );
};

export default FeedPage;
