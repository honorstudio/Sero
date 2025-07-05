import React, { useEffect, useRef } from 'react';
import { Message } from '../../types';
import { formatMessageTime } from '../../utils/messageUtils';
import './ChatMessage.module.css';

interface ChatMessageProps {
  message: Message;
  aiName?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, aiName = '세로' }) => {
  const isAi = message.sender === 'ai';
  const timeStr = formatMessageTime(message.createdAt);
  const messageRef = useRef<HTMLDivElement>(null);

  // 메시지가 마운트될 때 애니메이션 적용
  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.opacity = '0';
      messageRef.current.style.transform = 'translateY(20px) scale(0.98)';
      
      // 약간의 지연 후 애니메이션 시작
      setTimeout(() => {
        if (messageRef.current) {
          messageRef.current.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
          messageRef.current.style.opacity = '1';
          messageRef.current.style.transform = 'translateY(0) scale(1)';
        }
      }, 50);
    }
  }, []);

  return (
    <div 
      ref={messageRef}
      className={`chat-message ${isAi ? 'ai' : 'user'}`} 
      style={isAi ? { position: 'relative', paddingTop: 22, paddingLeft: 8 } : {}}
    >
      {/* 세로(AI) 메시지일 때만 이름 표시 */}
      {isAi && (
        <div style={{ 
          position: 'absolute', 
          left: 12, 
          top: 6, 
          fontSize: 13, 
          color: '#1976d2', 
          fontWeight: 700, 
          letterSpacing: 0.2 
        }}>
          {aiName}
        </div>
      )}
      <div className="chat-message-content" style={{ whiteSpace: 'pre-line' }}>
        {message.text}
      </div>
      <div className="chat-message-time">
        {timeStr}
      </div>
    </div>
  );
};

export default ChatMessage; 