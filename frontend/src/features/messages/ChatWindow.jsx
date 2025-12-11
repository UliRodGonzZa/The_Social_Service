/**
 * ChatWindow - Ventana de chat
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { sendMessage, fetchConversation } from './messagesSlice';

const ChatWindow = ({ otherUsername }) => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);
  const { messages, loading } = useSelector((state) => state.messages);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentUser && otherUsername) {
      dispatch(fetchConversation({
        username: currentUser.username,
        otherUsername
      }));
    }
  }, [dispatch, currentUser, otherUsername]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !currentUser || !otherUsername) return;

    setSending(true);
    try {
      await dispatch(sendMessage({
        sender_username: currentUser.username,
        receiver_username: otherUsername,
        content: messageText.trim()
      })).unwrap();

      setMessageText('');
      
      // Reload conversation to get the new message
      dispatch(fetchConversation({
        username: currentUser.username,
        otherUsername
      }));
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    } finally {
      setSending(false);
    }
  };

  if (!otherUsername) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-bg">
        <div className="text-center text-text-secondary">
          <div className="text-6xl mb-4">📨</div>
          <h2 className="text-2xl font-bold mb-2">Tus mensajes</h2>
          <p>Selecciona una conversación para comenzar a chatear</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-bg">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-dark-border bg-dark-card">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-accent-dark rounded-full flex items-center justify-center">
            <span className="text-white font-bold">
              {otherUsername?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-bold">{otherUsername}</p>
            <p className="text-xs text-text-secondary">Activo</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-secondary">
              <p>No hay mensajes aún</p>
              <p className="text-sm mt-2">Envía el primer mensaje</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.sender_username === currentUser?.username;
              const timeAgo = message.created_at
                ? formatDistanceToNow(new Date(message.created_at), {
                    addSuffix: true,
                    locale: es
                  })
                : '';

              return (
                <div
                  key={message.id || index}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-accent text-white rounded-br-none'
                          : 'bg-dark-card text-text-primary rounded-bl-none'
                      }`}
                    >
                      <p className="break-words">{message.content}</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-1 px-2">
                      <span className="text-xs text-text-secondary">{timeAgo}</span>
                      {message.read && isOwn && (
                        <span className="text-xs text-accent">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-dark-border bg-dark-card">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-dark-bg text-text-primary px-4 py-2 rounded-full border border-dark-border focus:outline-none focus:border-accent transition-colors"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="btn-primary rounded-full px-6"
          >
            {sending ? '...' : '📨'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
