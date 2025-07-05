import { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { messageService } from '../services/firebaseService';
import { splitSentences } from '../utils/messageUtils';

export const useChat = (userId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastLoadedDoc, setLastLoadedDoc] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 초기 메시지 로드
  useEffect(() => {
    if (!userId) return;
    
    const loadInitialMessages = async () => {
      setLoadingMore(true);
      try {
        const recentMessages = await messageService.getRecentMessages(userId, 30);
        setMessages(recentMessages);
        setHasMoreMessages(recentMessages.length === 30);
      } catch (error) {
        console.error('메시지 로드 오류:', error);
      }
      setLoadingMore(false);
    };

    loadInitialMessages();
  }, [userId]);

  // 실시간 메시지 구독
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = messageService.subscribeToMessages(userId, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [userId]);

  // 스크롤 최하단 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // 이전 메시지 로드 (무한 스크롤)
  const loadMoreMessages = async () => {
    if (!userId || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      const result = await messageService.getMoreMessages(userId, lastLoadedDoc, 20);
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
    if (!userId) return;
    
    try {
      if (msg.sender === 'ai') {
        // AI 메시지는 문장별로 분리하여 저장
        await addAiMessagesWithDelay(msg.text);
      } else {
        // 사용자 메시지는 바로 저장
        await messageService.saveMessage(userId, msg);
      }
    } catch (error) {
      console.error('메시지 저장 오류:', error);
    }
  };

  // AI 메시지 여러 문장 순차 출력
  const addAiMessagesWithDelay = async (text: string) => {
    const sentences = splitSentences(text);
    setAiTyping(true);
    
    // 파티클 효과 활성화
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(true);
    }

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      await new Promise(res => setTimeout(res, Math.max(sentence.length * 80, 300)));
      
      const aiMessage: Message = { 
        sender: 'ai', 
        text: sentence, 
        createdAt: new Date() 
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      if (userId) {
        await messageService.saveMessage(userId, aiMessage);
      }
    }

    setAiTyping(false);
    
    // 파티클 효과 비활성화
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(false);
    }
  };

  // 파티클 효과 제어
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(aiTyping);
    }
  }, [aiTyping]);

  return {
    messages,
    loading,
    setLoading,
    aiTyping,
    hasMoreMessages,
    loadingMore,
    messagesEndRef,
    scrollToBottom,
    loadMoreMessages,
    saveMessage,
    addAiMessagesWithDelay
  };
}; 