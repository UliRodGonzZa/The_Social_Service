/**
 * ConversationList - Lista de conversaciones
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const ConversationList = ({ conversations, currentConversation, onSelectConversation }) => {
  if (conversations.length === 0) {
    return (
      <div className="p-4">
        <div className="card p-4 text-center">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-text-secondary text-sm">No hay conversaciones</p>
          <p className="text-text-secondary text-xs mt-2">
            Busca usuarios y envíales un mensaje
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conversation) => {
        const isActive = currentConversation === conversation.username;
        const timeAgo = conversation.last_message_at 
          ? formatDistanceToNow(new Date(conversation.last_message_at), { 
              addSuffix: true, 
              locale: es 
            })
          : '';

        return (
          <div
            key={conversation.username}
            onClick={() => onSelectConversation(conversation.username)}
            className={`px-4 py-3 border-b border-dark-border cursor-pointer transition-colors ${
              isActive 
                ? 'bg-dark-hover border-l-4 border-l-accent' 
                : 'hover:bg-dark-hover/50'
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-accent-dark rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">
                  {conversation.username?.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold truncate">{conversation.username}</p>
                  {timeAgo && (
                    <span className="text-xs text-text-secondary flex-shrink-0">
                      {timeAgo}
                    </span>
                  )}
                </div>
                
                {conversation.last_message && (
                  <p className="text-sm text-text-secondary truncate">
                    {conversation.last_message}
                  </p>
                )}
                
                {conversation.unread_count > 0 && (
                  <div className="inline-flex items-center justify-center bg-accent text-white text-xs font-bold rounded-full w-5 h-5 mt-1">
                    {conversation.unread_count}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
