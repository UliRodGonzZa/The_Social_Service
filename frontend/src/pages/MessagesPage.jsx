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
import { usersAPI } from '../services/api';

const MessagesPage = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { conversations } = useSelector((state) => state.messages);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (currentUser?.username) {
      dispatch(fetchConversations(currentUser.username));
    }
  }, [dispatch, currentUser]);

  const handleSelectConversation = (username) => {
    setSelectedUser(username);
    dispatch(setCurrentConversation(username));
    setShowNewChatModal(false);
  };

  const handleNewChat = async () => {
    setShowNewChatModal(true);
    if (allUsers.length === 0) {
      setLoadingUsers(true);
      try {
        const response = await usersAPI.listUsers();
        // Filtrar el usuario actual
        const users = response.data.filter(u => u.username !== currentUser?.username);
        setAllUsers(users);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const username = conv.with_username || conv.username;
    return username?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredUsers = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold">💬 Mensajes</h1>
            <button
              onClick={handleNewChat}
              className="btn-primary text-sm px-4 py-2"
              data-testid="new-chat-button"
            >
              ✉️ Nuevo chat
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Conversations List */}
          <div className="w-80 border-r border-dark-border flex flex-col">
            <div className="px-4 py-3 border-b border-dark-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={showNewChatModal ? "Buscar usuario..." : "Buscar conversación..."}
                className="w-full bg-dark-bg text-text-primary px-4 py-2 rounded-full border border-dark-border focus:outline-none focus:border-accent transition-colors text-sm"
                data-testid="search-conversation-input"
              />
            </div>

            {showNewChatModal ? (
              <div className="flex-1 overflow-y-auto" data-testid="new-chat-modal">
                <div className="px-4 py-2 bg-dark-card border-b border-dark-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-secondary">
                    Seleccionar usuario
                  </span>
                  <button
                    onClick={() => setShowNewChatModal(false)}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>
                
                {loadingUsers ? (
                  <div className="p-4 text-center text-text-secondary">
                    Cargando usuarios...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-text-secondary">
                    No se encontraron usuarios
                  </div>
                ) : (
                  <div>
                    {filteredUsers.map((user) => (
                      <div
                        key={user.username}
                        onClick={() => handleSelectConversation(user.username)}
                        className="px-4 py-3 border-b border-dark-border cursor-pointer hover:bg-dark-hover transition-colors"
                        data-testid={`user-item-${user.username}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-accent-dark rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {user.username?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold">{user.username}</p>
                            {user.name && (
                              <p className="text-sm text-text-secondary">{user.name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ConversationList
                conversations={filteredConversations}
                currentConversation={selectedUser}
                onSelectConversation={handleSelectConversation}
              />
            )}
          </div>
          
          {/* Chat Area */}
          <ChatWindow otherUsername={selectedUser} />
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
