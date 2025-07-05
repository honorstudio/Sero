import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isTyping: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isTyping, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isComposing || disabled) return;
    
    onSendMessage(inputValue.trim());
    setInputValue('');
    
    // 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  return (
    <div className={styles.chatInputContainer}>
      <div className={styles.chatInputWrapper}>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={isTyping ? "세로가 입력 중..." : "메시지를 입력하세요..."}
          disabled={disabled || isTyping}
          className={styles.chatInputTextarea}
          rows={1}
          maxLength={1000}
        />
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isComposing || disabled || isTyping}
          className={styles.chatInputSendBtn}
          aria-label="메시지 전송"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path 
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" 
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
      {isTyping && (
        <div className={styles.typingIndicator}>
          <span>세로가 입력 중</span>
          <div className={styles.typingDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInput; 