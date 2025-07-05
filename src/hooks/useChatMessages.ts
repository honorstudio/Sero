import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const PAGE_SIZE = 20;
const MORE_SIZE = 10;

export function useChatMessages(userId: string, personaId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const chatRef = collection(db, 'chats', userId, 'personas', personaId, 'messages');

  // 최초 로드
  useEffect(() => {
    setLoading(true);
    const q = query(chatRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    getDocs(q).then(snapshot => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setMessages(loaded);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setLoading(false);
    }).catch(e => {
      setError('메시지 로드 실패');
      setLoading(false);
    });
    // eslint-disable-next-line
  }, [userId, personaId]);

  // 이전 메시지 추가 로드
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    const q = query(chatRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(MORE_SIZE));
    const snapshot = await getDocs(q);
    const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
    setMessages(prev => [...loaded, ...prev]);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    setHasMore(snapshot.docs.length === MORE_SIZE);
    setLoadingMore(false);
  }, [hasMore, loadingMore, lastDoc, userId, personaId]);

  // 최신 메시지 실시간 구독 (맨 아래에 있을 때만)
  useEffect(() => {
    if (!isAtBottom) return;
    const q = query(chatRef, orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, snapshot => {
      const newMsg = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))[0];
      if (newMsg && (!messages.length || newMsg.id !== messages[messages.length - 1].id)) {
        setMessages(prev => [...prev, newMsg]);
      }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, [userId, personaId, isAtBottom, messages]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    setIsAtBottom,
  };
} 