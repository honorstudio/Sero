import { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { messageService } from '../services/firebaseService';
import { splitSentences } from '../utils/messageUtils';

export const useChat = (userId: string | null, personaId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastLoadedDoc, setLastLoadedDoc] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 초기 메시지 로드
  useEffect(() => {
    if (!userId || !personaId) return;
    
    const loadInitialMessages = async () => {
      setLoadingMore(true);
      try {
        const recentMessages = await messageService.getRecentMessages(userId, personaId, 30);
        setMessages(recentMessages);
        setHasMoreMessages(recentMessages.length === 30);
      } catch (error) {
        console.error('메시지 로드 오류:', error);
      }
      setLoadingMore(false);
    };

    loadInitialMessages();
  }, [userId, personaId]);

  // 실시간 메시지 구독
  useEffect(() => {
    if (!userId || !personaId) return;

    const unsubscribe = messageService.subscribeToMessages(userId, personaId, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [userId, personaId]);

  // 스크롤 최하단 이동
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }
  };

  // 이전 메시지 로드 (무한 스크롤)
  const loadMoreMessages = async () => {
    if (!userId || !personaId || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      const result = await messageService.getMoreMessages(userId, personaId, lastLoadedDoc, 20);
      setMessages(prev => [...result.messages, ...prev]);
      setLastLoadedDoc(result.lastDoc);
      setHasMoreMessages(result.messages.length === 20);
    } catch (error) {
      console.error('이전 메시지 로드 오류:', error);
    }
    setLoadingMore(false);
  };

  // 메시지 저장
  const saveMessage = async (msg: Message) => {
    if (!userId || !personaId) return;
    
    try {
      await messageService.saveMessage(userId, personaId, msg);
    } catch (error) {
      console.error('메시지 저장 오류:', error);
    }
  };

  return {
    messages,
    loading,
    setLoading,
    hasMoreMessages,
    loadingMore,
    messagesEndRef,
    scrollToBottom,
    loadMoreMessages,
    saveMessage
  };
}; 