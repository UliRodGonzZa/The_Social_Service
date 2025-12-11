/**
 * MessagesPage - Mensajes directos
 * 
 * INTEGRACIÓN NOSQL:
 * - MongoDB: Almacenar mensajes {sender, receiver, content, created_at}
 * - Neo4j: Relación (User)-[:MESSAGED]->(User) con timestamp
 * - Redis: Cache de conversaciones (TTL 5min)
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import ConversationList from '../features/messages/ConversationList';
import ChatWindow from '../features/messages/ChatWindow';
import { fetchConversations, setCurrentConversation } from '../features/messages/messagesSlice';

const MessagesPage = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { conversations, currentConversation } = useSelector((state) => state.messages);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (currentUser?.username) {
      dispatch(fetchConversations(currentUser.username));
    }
  }, [dispatch, currentUser]);

  const handleSelectConversation = (username) => {
    setSelectedUser(username);
    dispatch(setCurrentConversation(username));
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">💬 Mensajes</h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Conversations List */}
          <div className="w-80 border-r border-dark-border flex flex-col">
            <div className="px-4 py-3 border-b border-dark-border">
              <input
                type="text"
                placeholder="Buscar conversación..."
                className="w-full bg-dark-bg text-text-primary px-4 py-2 rounded-full border border-dark-border focus:outline-none focus:border-accent transition-colors text-sm"
              />
            </div>
            <ConversationList
              conversations={conversations}
              currentConversation={selectedUser}
              onSelectConversation={handleSelectConversation}
            />
          </div>
          
          {/* Chat Area */}
          <ChatWindow otherUsername={selectedUser} />
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
