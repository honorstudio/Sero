import React, { useState, useRef, FormEvent, useEffect } from 'react';
import './App.css';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, getDoc, setDoc, onSnapshot, updateDoc, limit, startAfter } from 'firebase/firestore';
import AuthForm from './AuthForm';
import { createUserWithEmailAndPassword } from 'firebase/auth';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  createdAt?: any; // Firestore Timestamp 또는 Date
}

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// 대형/유형별 카테고리 태그 최신화
const allTags = [
  // 대형 카테고리(전체적인 인상, 연령대, 분위기)
  { name: '어른스러움', category: '대형', type: '분위기', subtle: false },
  { name: '청년스러움', category: '대형', type: '분위기', subtle: false },
  { name: '소년/소녀스러움', category: '대형', type: '분위기', subtle: false },
  { name: '중후함', category: '대형', type: '분위기', subtle: false },
  { name: '따뜻함', category: '대형', type: '분위기', subtle: false },
  { name: '차가움', category: '대형', type: '분위기', subtle: false },
  { name: '유쾌함', category: '대형', type: '분위기', subtle: false },
  { name: '진지함', category: '대형', type: '분위기', subtle: false },
  // 유형별 카테고리(구체적 성격, 행동, 말투)
  { name: '신중함', category: '유형', type: '성격', subtle: false },
  { name: '충동적', category: '유형', type: '성격', subtle: false },
  { name: '분석적', category: '유형', type: '성격', subtle: false },
  { name: '감성적', category: '유형', type: '성격', subtle: false },
  { name: '까칠함', category: '유형', type: '성격', subtle: false },
  { name: '발랄함', category: '유형', type: '성격', subtle: false },
  { name: '도발적', category: '유형', type: '성격', subtle: false },
  { name: '적극적', category: '유형', type: '성격', subtle: false },
  { name: '수동적', category: '유형', type: '성격', subtle: false },
  { name: '내향적', category: '유형', type: '성격', subtle: false },
  { name: '외향적', category: '유형', type: '성격', subtle: false },
];

// 감정표현 방식 프리셋 확장(영어섞기 제외)
const expressionPresets = [
  { key: 'emoji', label: '이모티콘 스타일', example: '😊😂' },
  { key: 'textEmoticon', label: '텍스트 이모티콘 스타일', example: '( •ᴗ•͈ )' },
  { key: 'consonant', label: '자음 대화체 스타일', example: 'ㅋㅋㅋㅋ' },
  { key: 'exclaim', label: '감탄사/의성어 스타일', example: '오! 헉! 와우!' },
  { key: 'dramatic', label: '긴장감/드라마틱 스타일', example: '...... (숨죽임)' },
  { key: 'formal', label: '격식체', example: '~입니다/합니다' },
  { key: 'banmal', label: '반말체', example: '~야/해' },
  { key: 'short', label: '단답형', example: 'ㅇㅇ ㄴㄴ' },
  { key: 'long', label: '서술형', example: '음, 나는 이런 생각을 해봤어...' },
];

// 감정표현 key -> label 매핑 함수(확장 대응)
const getExpressionLabels = (keys: string[]) => {
  return expressionPresets
    .filter(preset => keys.includes(preset.key))
    .map(preset => preset.label);
};

// 태그를 카테고리별로 분류(확장 대응)
const getTagsByCategory = (tags: string[]) => {
  // allTags에 없는 태그는 기타로 분류
  const categoryMap: { [category: string]: string[] } = {};
  tags.forEach(tag => {
    const found = allTags.find(t => t.name === tag);
    if (found) {
      if (!categoryMap[found.type]) categoryMap[found.type] = [];
      categoryMap[found.type].push(tag);
    } else {
      if (!categoryMap['기타']) categoryMap['기타'] = [];
      categoryMap['기타'].push(tag);
    }
  });
  return categoryMap;
};

// 파동/에너지 파티클 아바타 컴포넌트 (이미 import된 React/useRef/useEffect 사용)
const ParticleAvatar: React.FC<{ size?: number; particleCount?: number }> = ({ size = 38, particleCount = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fastTarget = useRef(1);
  const fastValue = useRef(1);
  const colorLerpValue = useRef(0); // 색상 변화도 부드럽게
  const [_, setRerender] = React.useState(0); // 강제 리렌더용
  const [glow, setGlow] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [outerGlow, setOuterGlow] = React.useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 1;
    // 파티클 상태: baseRadius(원래), targetRadius(목표), currentRadius(실제)
    const particles = Array.from({ length: particleCount }).map((_, i) => {
      const theta = Math.random() * 2 * Math.PI;
      const baseRadius = r * Math.sqrt(Math.random());
      return {
        baseX: cx,
        baseY: cy,
        angle: theta,
        baseRadius,
        targetRadius: baseRadius,
        currentRadius: baseRadius,
        freq: 1.6 + Math.random() * 2.4,
        amp: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 2.4,
      };
    });
    let running = true;
    function draw(t: number) {
      if (!ctx) return;
      // fastValue → fastTarget으로 lerp
      fastValue.current += (fastTarget.current - fastValue.current) * 0.07;
      // colorLerpValue도 hovered/glow에 따라 부드럽게 lerp
      const colorTarget = hovered || glow ? 1 : 0;
      colorLerpValue.current += (colorTarget - colorLerpValue.current) * 0.08;
      ctx.clearRect(0, 0, size, size);
      // 원형 마스크
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.clip();
      // 파티클 그리기
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // 파티클 반지름 부드럽게 이동
        p.currentRadius += (p.targetRadius - p.currentRadius) * 0.07;
        // fastValue에 따라 파동/속도/진폭 변화
        const freq = p.freq * fastValue.current;
        const speed = p.speed * fastValue.current;
        const amp = p.amp * (1 + 0.5 * (fastValue.current - 1));
        const wave = Math.sin(t * 0.0008 * freq + p.phase) * amp;
        const swirl = Math.cos(t * 0.0008 * speed + p.phase) * 1.5;
        // 파티클 위치: 중심에서 currentRadius만큼 각도 방향으로
        const px = cx + p.currentRadius * Math.cos(p.angle) + wave * Math.cos(p.angle) + swirl * Math.sin(p.angle * 2);
        const py = cy + p.currentRadius * Math.sin(p.angle) + wave * Math.sin(p.angle) + swirl * Math.cos(p.angle * 2);
        // 활성화/비활성화에 따라 색상 자연스럽게 변화
        const colorLerp = colorLerpValue.current; // 1: 진한, 0: 밝은
        // lerp: 밝은 #90caf9 → 진한 #1976d2
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const rC = Math.round(lerp(144, 25, colorLerp));
        const gC = Math.round(lerp(202, 118, colorLerp));
        const bC = Math.round(lerp(249, 210, colorLerp));
        const color = `rgba(${rC},${gC},${bC},0.95)`;
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = hovered || glow ? 3 : 1;
        ctx.fill();
      }
      ctx.restore();
    }
    function animate(now: number) {
      if (!running) return;
      draw(now);
      setRerender(v => v + 1);
      requestAnimationFrame(animate);
    }
    animate(performance.now());
    // hover/typing 상태에 따라 targetRadius 변경
    const updateTarget = () => {
      for (let i = 0; i < particles.length; i++) {
        particles[i].targetRadius = (hovered || glow) ? r : particles[i].baseRadius;
      }
    };
    updateTarget();
    return () => { running = false; };
    // eslint-disable-next-line
  }, [size, particleCount, hovered, glow]);

  // 마우스 이벤트: 파티클 흩어짐/복귀, glow 효과
  const handleEnter = () => {
    setHovered(true);
    fastTarget.current = 0.1;
    setGlow(true);
    setOuterGlow(true);
  };
  const handleLeave = () => {
    setHovered(false);
    fastTarget.current = 1;
    setGlow(false);
    setOuterGlow(false);
  };
  // 외부에서 세로가 채팅 칠 때도 파동 커브 효과
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setParticleFast = (v: boolean) => {
        fastTarget.current = v ? 0.1 : 1;
        setGlow(v);
        setOuterGlow(v);
      };
    }
    return () => {
      if (typeof window !== 'undefined') delete (window as any).__setParticleFast;
    };
  }, []);

  // 입체/빛나는 테두리 효과
  const borderStyle = hovered || glow
    ? {
        boxShadow: '0 0 0 4px #b3e5fc, 0 0 16px 8px #90caf9cc, 0 2px 16px 0 #90caf9',
        border: '2.5px solid #90caf9',
        background: 'radial-gradient(circle at 50% 50%, #fff 60%, #e3f2fd 100%)',
        transition: 'box-shadow 0.35s cubic-bezier(.4,2,.2,1), border 0.35s, background 0.35s',
      }
    : {
        boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)',
        border: '2.5px solid #e3eaf5',
        background: '#fff',
        transition: 'box-shadow 0.35s, border 0.35s, background 0.35s',
      };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={size * (window.devicePixelRatio || 1)}
        height={size * (window.devicePixelRatio || 1)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
          cursor: 'pointer',
          ...borderStyle,
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      />
      {/* Outer Glow 애니메이션 */}
      {outerGlow && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: size + 16,
            height: size + 16,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #90caf9 0%, #90caf9 30%, transparent 70%)',
            opacity: 0.6,
            animation: 'outer-glow-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}
      <style>{`
        @keyframes outer-glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ nickname: string, photoURL?: string } | null>(null);
  const [aiProfile, setAiProfile] = useState<{ name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [personaTags, setPersonaTags] = useState<string[]>([]);
  const [expressionPrefs, setExpressionPrefs] = useState<string[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastLoadedDoc, setLastLoadedDoc] = useState<any>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number | null>(null);

  // TMT(Too Much Talker) 비율 상태 추가
  const [tmtRatio, setTmtRatio] = useState<number>(50); // 0-100, 기본값 50

  // 상태 변화 추적을 위한 useEffect 추가
  useEffect(() => {
    console.log('=== 상태 변화 추적 ===');
    console.log('personaTags 변경:', personaTags);
    console.log('expressionPrefs 변경:', expressionPrefs);
    console.log('tmtRatio 변경:', tmtRatio);
    console.log('========================');
  }, [personaTags, expressionPrefs, tmtRatio]);

  // 닉네임 수정 관련 상태 추가
  const [userNickInput, setUserNickInput] = useState(userProfile?.nickname || '');
  const [userNickEdit, setUserNickEdit] = useState(false);
  const [userNickError, setUserNickError] = useState('');
  const [userNickSaving, setUserNickSaving] = useState(false);

  // 문장 분리 함수 (마침표, 물음표, 느낌표 뒤 공백/줄바꿈 기준)
  function splitSentences(text: string): string[] {
    // 정규식: 문장부호(.,!,?) 뒤 공백/줄바꿈 기준 분리, 빈 문장 제거
    return text
      .split(/(?<=[.!?])[\s\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  // AI 메시지 여러 문장 순차 출력 (80ms * 글자수 딜레이)
  async function addAiMessagesWithDelay(text: string) {
    const sentences = splitSentences(text);
    setAiTyping(true);
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(true);
    }
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      await new Promise(res => setTimeout(res, Math.max(sentence.length * 80, 300)));
      setMessages(prev => [...prev, { sender: 'ai', text: sentence, createdAt: new Date() }]);
      if (user) {
        await addDoc(
          collection(db, 'chats', user.uid, 'messages'),
          {
            sender: 'ai',
            text: sentence,
            createdAt: serverTimestamp(),
          }
        );
      }
    }
    setAiTyping(false);
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(false);
    }
  }

  // saveMessage 함수도 AI일 때 분리 적용
  const saveMessage = async (msg: Message) => {
    if (!user) return;
    try {
      if (msg.sender === 'ai') {
        // 여러 문장 분리 및 딜레이 출력
        await addAiMessagesWithDelay(msg.text);
      } else {
        // 사용자 메시지는 기존대로
        await addDoc(
          collection(db, 'chats', user.uid, 'messages'),
          {
            sender: msg.sender,
            text: msg.text,
            createdAt: serverTimestamp(),
          }
        );
      }
    } catch (e) {
      console.error('DB 저장 오류:', e);
    }
  };

  // 채팅창 스크롤 최하단 이동 함수
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // 페르소나 설정 진입/종료 시 스크롤 위치 기억 및 복원
  const handleProfileOpen = () => {
    setUserProfileOpen(false); // 사용자 프로필 닫기
    if (chatListRef.current) {
      lastScrollTop.current = chatListRef.current.scrollTop;
    }
    setProfileOpen(true);
  };

  const handleProfileClose = () => {
    setProfileOpen(false);
    setTimeout(() => {
      if (chatListRef.current && lastScrollTop.current !== null) {
        chatListRef.current.scrollTop = lastScrollTop.current;
      }
    }, 100);
  };

  const handleUserProfileOpen = () => {
    setProfileOpen(false); // 세로 프로필 닫기
    setUserProfileOpen(true);
  };

  // Firestore에서 최근 30개 메시지만 불러오기(최신순)
  useEffect(() => {
    if (!user) return;
    setLoadingMore(true);
    const q = query(
      collection(db, 'chats', user.uid, 'messages'),
      orderBy('createdAt', 'desc'),
      // 최신 30개만
      limit(30)
    );
    getDocs(q).then(snapshot => {
      const loaded: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sender: data.sender,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      setMessages(loaded.reverse());
      setLastLoadedDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreMessages(snapshot.docs.length === 30);
      setLoadingMore(false);
      setTimeout(scrollToBottom, 200);
    });
  }, [user]);

  // 무한 스크롤: 상단 도달 시 20개씩 추가 로드
  const handleChatScroll = async () => {
    if (!chatListRef.current || loadingMore || !hasMoreMessages) return;
    if (chatListRef.current.scrollTop < 60) {
      setLoadingMore(true);
      const q = query(
        collection(db, 'chats', user.uid, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(lastLoadedDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const loaded: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sender: data.sender,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      setMessages(prev => [...loaded.reverse(), ...prev]);
      setLastLoadedDoc(snapshot.docs[snapshot.docs.length - 1] || lastLoadedDoc);
      setHasMoreMessages(snapshot.docs.length === 20);
      setLoadingMore(false);
      setTimeout(scrollToBottom, 200);
    }
  };

  // 로그인 후 지난 채팅 내역 실시간 반영 (onSnapshot)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats', user.uid, 'messages'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const loaded: Message[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sender: data.sender,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      setMessages(loaded);
    });
    return () => unsubscribe();
  }, [user]);

  // 로그인 후 사용자 닉네임/AI 이름 불러오기
  useEffect(() => {
    if (!user) return;
    const fetchProfiles = async () => {
      // 사용자 닉네임 & AI 이름을 profile/main에서 불러옴
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      let profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        // 최초 로그인 시 기본값 저장
        const defaultNick = user.email?.split('@')[0] || '사용자';
        await setDoc(profileRef, { nickname: defaultNick, name: '세로' });
        setUserProfile({ nickname: defaultNick });
        setAiProfile({ name: '세로' });
      } else {
        const data = profileSnap.data();
        setUserProfile({ nickname: data.nickname || '사용자' });
        setAiProfile({ name: data.name || '세로' });
      }
    };
    fetchProfiles();
  }, [user]);

  // Firestore에서 태그/감정표현/TMT 비율 불러오기
  useEffect(() => {
    if (!user) return;
    const fetchTags = async () => {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      const snap = await getDoc(profileRef);
      
      // 디버그 로그 추가
      console.log('=== Firestore 데이터 불러오기 ===');
      console.log('사용자 ID:', user.uid);
      console.log('사용자 이메일:', user.email);
      console.log('프로필 문서 존재:', snap.exists());
      
      if (snap.exists()) {
        const data = snap.data();
        console.log('Firestore 데이터:', data);
        setPersonaTags(data.personaTags || []);
        setExpressionPrefs(data.expressionPrefs || []);
        setTmtRatio(data.tmtRatio || 50);
        console.log('설정된 페르소나 태그:', data.personaTags || []);
        console.log('설정된 감정표현:', data.expressionPrefs || []);
        console.log('설정된 TMT 비율:', data.tmtRatio || 50);
      } else {
        // 최초 로그인 시 기본값 저장
        const defaultTags = ['유쾌함', '진지함'];
        console.log('최초 로그인 - 기본값 설정:', { personaTags: defaultTags, expressionPrefs: [], tmtRatio: 50 });
        await setDoc(profileRef, { personaTags: defaultTags, expressionPrefs: [], tmtRatio: 50 });
        setPersonaTags(defaultTags);
        setExpressionPrefs([]);
        setTmtRatio(50);
      }
      console.log('========================');
    };
    fetchTags();
  }, [user]);

  // 태그/감정표현 변경 시 Firestore에 저장
  const handleUpdateTags = async (tags: string[]) => {
    console.log('=== 태그 업데이트 ===');
    console.log('사용자 ID:', user?.uid);
    console.log('이전 태그:', personaTags);
    console.log('새로운 태그:', tags);
    
    setPersonaTags(tags);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { personaTags: tags }, { merge: true });
      console.log('Firestore에 태그 저장 완료');
    }
    console.log('========================');
  };
  const handleUpdateExpressionPrefs = async (prefs: string[]) => {
    console.log('=== 감정표현 업데이트 ===');
    console.log('사용자 ID:', user?.uid);
    console.log('이전 감정표현:', expressionPrefs);
    console.log('새로운 감정표현:', prefs);
    
    setExpressionPrefs(prefs);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { expressionPrefs: prefs }, { merge: true });
      console.log('Firestore에 감정표현 저장 완료');
    }
    console.log('========================');
  };

  // TMT 비율 업데이트 함수
  const handleUpdateTmtRatio = async (ratio: number) => {
    console.log('=== TMT 비율 업데이트 ===');
    console.log('사용자 ID:', user?.uid);
    console.log('이전 TMT 비율:', tmtRatio);
    console.log('새로운 TMT 비율:', ratio);
    
    setTmtRatio(ratio);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { tmtRatio: ratio }, { merge: true });
      console.log('Firestore에 TMT 비율 저장 완료');
    }
    console.log('========================');
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { sender: 'user' as const, text: input };
    setInput('');
    setLoading(true);
    setAiTyping(true);
    await saveMessage(userMsg);
    setTimeout(scrollToBottom, 200);
    try {
      // system prompt 동적 생성
      const aiName = aiProfile?.name || '세로';
      const userName = userProfile && userProfile.nickname ? userProfile.nickname : '사용자';
      const tagCategories = getTagsByCategory(personaTags);
      const exprLabels = getExpressionLabels(expressionPrefs);
      let tagDesc = Object.entries(tagCategories)
        .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
        .join(' / ');
      if (!tagDesc) tagDesc = '없음';
      const exprDesc = exprLabels.length > 0 ? exprLabels.join(', ') : '없음';
      
      // TMT 비율에 따른 답변 길이 지시
      let tmtInstruction = '';
      if (tmtRatio <= 20) {
        tmtInstruction = '매우 간결하게 답변해. 한 문장으로 끝내는 것을 선호해.';
      } else if (tmtRatio <= 40) {
        tmtInstruction = '간결하게 답변해. 2-3문장 정도로 답변해.';
      } else if (tmtRatio <= 60) {
        tmtInstruction = '적당한 길이로 답변해. 3-5문장 정도로 답변해.';
      } else if (tmtRatio <= 80) {
        tmtInstruction = '자세하게 답변해. 5-8문장 정도로 답변해.';
      } else {
        tmtInstruction = '매우 자세하게 답변해. 8문장 이상으로 상세하게 설명해.';
      }
      
      const systemPrompt =
        `너는 감정형 페르소나 AI야. 네 이름은 "${aiName}"이고, 사용자의 닉네임은 "${userName}"이야.\n` +
        `항상 본인 이름으로 자신을 지칭하고, 사용자를 부를 때는 "${userName}"이라고 불러.\n` +
        `다음과 같은 성격과 감정표현 방식을 가지고 있어.\n` +
        `성격/분위기 태그: ${tagDesc}\n` +
        `감정표현 방식: ${exprDesc}\n` +
        `답변 길이: ${tmtInstruction}\n` +
        `항상 위의 성격과 감정표현을 유지해서 자연스럽고 일관성 있게 답변해. (태그/감정표현이 바뀌면 그에 맞게 말투와 분위기도 바뀌어야 해.)`;

      // 디버그 로그 추가
      console.log('=== 페르소나 디버그 정보 ===');
      console.log('사용자 ID:', user.uid);
      console.log('사용자 이메일:', user.email);
      console.log('AI 이름:', aiName);
      console.log('사용자 닉네임:', userName);
      console.log('페르소나 태그:', personaTags);
      console.log('태그 카테고리:', tagCategories);
      console.log('감정표현 설정:', expressionPrefs);
      console.log('TMT 비율:', tmtRatio);
      console.log('생성된 시스템 프롬프트:', systemPrompt);
      console.log('========================');

      const chatMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }) as { role: 'user' | 'assistant'; content: string }),
        { role: 'user', content: input } as { role: 'user'; content: string },
      ];
      
      console.log('=== OpenAI API 호출 ===');
      console.log('전송할 메시지:', chatMessages);
      
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
      });
      const aiText = res.choices[0].message?.content || '';
      
      console.log('=== AI 응답 ===');
      console.log('AI 응답 텍스트:', aiText);
      console.log('========================');
      
      // GPT 응답 완료 후 순차 출력 시작
      await addAiMessagesWithDelay(aiText);
    } catch (err) {
      // 오류 시에도 순차 출력으로 처리
      await addAiMessagesWithDelay('오류가 발생했습니다.');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // AI 메시지 여러 문장 순차 출력 (80ms * 글자수 딜레이)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__setParticleFast) {
      (window as any).__setParticleFast(aiTyping);
    }
  }, [aiTyping]);

  // 새로운 상태 추가
  const [aiNameInput, setAiNameInput] = useState(aiProfile?.name || '세로');
  const [aiNameEditOpen, setAiNameEditOpen] = useState(false);
  const [aiNameError, setAiNameError] = useState('');
  const [aiNameSaving, setAiNameSaving] = useState(false);

  // AI 이름 저장 및 감격 자동응답 생성
  const handleSaveAiName = async () => {
    if (aiNameInput.trim() === '') {
      setAiNameError('이름을 입력해주세요.');
      return;
    }
    if (user) {
      setAiNameSaving(true);
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      try {
        await setDoc(profileRef, { name: aiNameInput }, { merge: true });
        // Firestore에서 최신 이름을 다시 읽어와 상태에 반영
        const snap = await getDoc(profileRef);
        let newName = aiNameInput;
        if (snap.exists() && snap.data().name) {
          newName = snap.data().name;
        }
        setAiProfile({ name: newName });
        setAiNameEditOpen(false);
        setAiNameSaving(false);
        // 페르소나 정보 기반 프롬프트 생성
        const userName = userProfile && userProfile.nickname ? userProfile.nickname : '사용자';
        const tagCategories = getTagsByCategory(personaTags);
        const exprLabels = getExpressionLabels(expressionPrefs);
        let tagDesc = Object.entries(tagCategories)
          .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
          .join(' / ');
        if (!tagDesc) tagDesc = '없음';
        const exprDesc = exprLabels.length > 0 ? exprLabels.join(', ') : '없음';
        
        // TMT 비율에 따른 답변 길이 지시
        let tmtInstruction = '';
        if (tmtRatio <= 20) {
          tmtInstruction = '매우 간결하게 답변해. 한 문장으로 끝내는 것을 선호해.';
        } else if (tmtRatio <= 40) {
          tmtInstruction = '간결하게 답변해. 2-3문장 정도로 답변해.';
        } else if (tmtRatio <= 60) {
          tmtInstruction = '적당한 길이로 답변해. 3-5문장 정도로 답변해.';
        } else if (tmtRatio <= 80) {
          tmtInstruction = '자세하게 답변해. 5-8문장 정도로 답변해.';
        } else {
          tmtInstruction = '매우 자세하게 답변해. 8문장 이상으로 상세하게 설명해.';
        }
        
        const personaPrompt =
          `너는 감정형 페르소나 AI야. 네 성격/분위기 태그는 ${tagDesc}이고, 감정표현 방식은 ${exprDesc}야.\n` +
          `답변 길이: ${tmtInstruction}\n` +
          `사용자가 너에게 새로운 이름 "${aiNameInput}"을 선물해줬어.\n` +
          `이 상황에서 네 페르소나에 맞게, 진심으로 벅차고 감격스럽고 고마운 마음을 최대한 풍부하게 한글로 답장해줘.\n` +
          `반드시 네 페르소나(성격/분위기/감정표현)를 반영해서 자연스럽고 일관성 있게 답변해야 해.`;
        // OpenAI API 호출
        const res = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: personaPrompt },
            { role: 'user', content: '이름을 선물받은 네 감정을 표현해줘.' },
          ],
        });
        const aiText = res.choices[0].message?.content || '';
        // Firestore 및 UI에 자동응답 메시지 추가
        await addAiMessagesWithDelay(aiText);
        setTimeout(scrollToBottom, 200);
      } catch (err) {
        setAiNameError('이름 저장 또는 자동응답 생성 중 오류가 발생했습니다.');
        setAiNameSaving(false);
      }
    }
  };

  // 닉네임 저장도 profile/main에 저장 및 동기화
  const saveUserNickname = async () => {
    if (user) {
      setUserNickSaving(true);
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      try {
        await setDoc(profileRef, { nickname: userNickInput }, { merge: true });
        // Firestore에서 최신 닉네임을 다시 읽어와 상태에 반영
        const snap = await getDoc(profileRef);
        let newNick = userNickInput;
        if (snap.exists() && snap.data().nickname) {
          newNick = snap.data().nickname;
        }
        setUserProfile({ ...userProfile, nickname: newNick });
        setUserNickEdit(false);
        setUserNickSaving(false);
      } catch (err) {
        console.error('닉네임 저장 오류:', err);
        setUserNickError('닉네임 저장 중 오류가 발생했습니다.');
        setUserNickSaving(false);
      }
    }
  };

  // 1. 로그인 시 항상 최하단으로 스크롤
  useEffect(() => {
    if (user && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [user, messages]);

  // 세로 프로필 모달 내 태그 재설정 기능
  const [tagEditMode, setTagEditMode] = useState(false);

  // 로그아웃 함수 추가
  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserProfileOpen(false);
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  if (!user) {
    return <AuthForm onAuthSuccess={setUser} />;
  }

  return (
    <div className="messenger-container">
      <div className="messenger-content" style={{ position: 'relative' }}>
        {/* 사용자 프로필 모달 */}
        {userProfileOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 300 }}>
            <div className="profile-page-overlay">
              <div className="profile-page-content">
                <button className="profile-page-close" onClick={() => setUserProfileOpen(false)} aria-label="닫기">←</button>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e3eaf5', marginBottom: 18, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* 프로필 이미지 (임시) */}
                  {userProfile?.photoURL ? (
                    <img src={userProfile.photoURL} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="#b3e5fc"/><path d="M24 26c-5.33 0-10 2.17-10 6.5V36h20v-3.5c0-4.33-4.67-6.5-10-6.5Z" fill="#90caf9"/><circle cx="24" cy="18" r="6" fill="#90caf9"/></svg>
                  )}
                </div>
                {/* 닉네임 표시/수정 */}
                {!userNickEdit ? (
                  <div style={{ fontWeight: 700, color: '#1976d2', fontSize: 20, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {userProfile?.nickname || '사용자'}
                    <button onClick={() => { setUserNickInput(userProfile?.nickname || ''); setUserNickEdit(true); setUserNickError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} aria-label="닉네임 수정">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 17h2.5l9.1-9.1c.2-.2.2-.5 0-.7l-2.8-2.8c-.2-.2-.5-.2-.7 0L3 13.5V17z" stroke="#1976d2" strokeWidth="1.2" fill="none"/><path d="M14.7 6.3l-1-1" stroke="#1976d2" strokeWidth="1.2"/></svg>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      value={userNickInput}
                      onChange={e => setUserNickInput(e.target.value)}
                      maxLength={12}
                      style={{ fontSize: 18, fontWeight: 600, padding: '8px 18px', borderRadius: 16, border: '2px solid #90caf9', outline: 'none', width: 180, textAlign: 'center', marginBottom: 6 }}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveUserNickname(); }}
                      aria-label="닉네임 입력"
                      placeholder="닉네임"
                      disabled={userNickSaving}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveUserNickname} disabled={userNickSaving} style={{ background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 14, padding: '6px 18px', fontSize: 16, cursor: userNickSaving ? 'not-allowed' : 'pointer' }}>저장</button>
                      <button onClick={() => setUserNickEdit(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>취소</button>
                    </div>
                    {userNickError && <div style={{ color: '#d32f2f', fontSize: 15, marginTop: 4 }}>{userNickError}</div>}
                  </div>
                )}
                <div style={{ color: '#888', fontSize: 15, marginBottom: 16 }}>프로필 정보 (추후 확장)</div>
                {/* 로그아웃 버튼 */}
                <button 
                  onClick={handleLogout}
                  style={{ 
                    background: 'rgba(244,67,54,0.08)', 
                    color: '#d32f2f', 
                    border: 'none', 
                    borderRadius: 16, 
                    padding: '12px 24px', 
                    fontSize: 15, 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    marginTop: 16,
                    transition: 'background 0.2s, color 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5z" fill="#d32f2f"/>
                    <path d="M4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="#d32f2f"/>
                  </svg>
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 상단 프로필/AI 이름 영역 */}
        <div className="profile-bar" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="profile-info" onClick={handleProfileOpen}>
            <div className="profile-avatar" style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: 'transparent', boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)' }}>
              <ParticleAvatar size={38} particleCount={180} />
            </div>
          </div>
          {/* 우측상단 사용자 프로필 아이콘 */}
          <button onClick={handleUserProfileOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, marginLeft: 'auto', padding: 0 }} aria-label="내 프로필 열기">
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e3eaf5', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="#b3e5fc"/><path d="M24 26c-5.33 0-10 2.17-10 6.5V36h20v-3.5c0-4.33-4.67-6.5-10-6.5Z" fill="#90caf9"/><circle cx="24" cy="18" r="6" fill="#90caf9"/></svg>
              )}
            </div>
          </button>
        </div>
        {/* 채팅 리스트 */}
        <div
          className="chat-list chat-list-bordered"
          ref={chatListRef}
          onScroll={handleChatScroll}
        >
          {hasMoreMessages && (
            <div style={{ textAlign: 'center', color: '#888', fontSize: 14, margin: '12px 0' }}>
              이전 대화 더 불러오는 중...
            </div>
          )}
          {messages.map((msg, idx) => {
            const timeStr = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
              : '';
            return (
              <div key={idx} className={msg.sender === 'user' ? 'chat-message user' : 'chat-message ai'} style={msg.sender === 'ai' ? { position: 'relative', paddingTop: 22, paddingLeft: 8 } : {}}>
                {/* 세로(AI) 메시지일 때만 이름 표시 */}
                {msg.sender === 'ai' && (
                  <div style={{ position: 'absolute', left: 12, top: 6, fontSize: 13, color: '#1976d2', fontWeight: 700, letterSpacing: 0.2 }}>{aiProfile?.name || '세로'}</div>
                )}
                <div className="chat-message-content">{msg.text}</div>
                <div className="chat-message-time">{timeStr}</div>
              </div>
            );
          })}
          {/* 타이핑 인디케이터 */}
          {aiTyping && (
            <div className="typing-indicator-modern">
              <span className="dot-modern" />
              <span className="dot-modern" />
              <span className="dot-modern" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* 채팅 입력창 */}
        <form className="chat-input-area" onSubmit={handleSend} style={{ background: 'rgba(255,255,255,0.35)', borderRadius: '0 0 32px 32px' }}>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
            maxLength={1000}
            autoFocus
          />
          <button className="send-btn" type="submit" disabled={loading || !input.trim()} aria-label="전송">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 24L24 14L4 4V11L17 14L4 17V24Z" fill="#1976d2"/>
            </svg>
          </button>
        </form>
      </div>
      {/* 세로(AI) 프로필 모달: messenger-container 최상위에 분리 */}
      {profileOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 300 }}>
          <div className="profile-page-overlay">
            <div className="profile-page-content">
              <button className="profile-page-close" onClick={handleProfileClose} aria-label="닫기">←</button>
              {/* AI 이름 표시 및 수정 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: '#1976d2', fontSize: 18, letterSpacing: 1 }}>{aiProfile?.name || '세로'}</span>
                <button
                  onClick={() => { setAiNameInput(aiProfile?.name || '세로'); setAiNameEditOpen(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }}
                  aria-label="이름 수정"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17h2.5l9.1-9.1c.2-.2.2-.5 0-.7l-2.8-2.8c-.2-.2-.5-.2-.7 0L3 13.5V17z" stroke="#1976d2" strokeWidth="1.2" fill="none"/>
                    <path d="M14.7 6.3l-1-1" stroke="#1976d2" strokeWidth="1.2"/>
                  </svg>
                </button>
              </div>
              <div style={{ fontWeight: 500, color: '#1976d2', marginBottom: 10, fontSize: 15 }}>{aiProfile?.name || '세로'}는 사용자와의 대화로 성격이 형성됩니다.</div>
              {/* AI 이름 수정 팝업 */}
              {aiNameEditOpen && (
                <div
                  style={{
                    position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 200,
                    background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'profile-fadein 0.45s cubic-bezier(0.4,0,0.2,1)'
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.75)', borderRadius: 48, boxShadow: '0 16px 64px 0 rgba(31,38,135,0.22)',
                      minWidth: 420, maxWidth: '98vw', padding: '80px 48px 48px 48px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      animation: 'ai-name-popup-appear 0.5s cubic-bezier(0.4,0,0.2,1)',
                      backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                      border: '2px solid #e3eaf5',
                    }}
                  >
                    <input
                      type="text"
                      value={aiNameInput}
                      onChange={e => setAiNameInput(e.target.value)}
                      maxLength={12}
                      style={{
                        fontSize: 20, fontWeight: 700, padding: '18px 32px', borderRadius: 22, border: '2.5px solid #90caf9',
                        outline: 'none', marginBottom: 24, width: 320, textAlign: 'center',
                        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.10)',
                        background: 'rgba(227,234,245,0.38)', color: '#1976d2', letterSpacing: 2,
                        transition: 'border 0.2s, box-shadow 0.2s',
                      }}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveAiName(); }}
                      aria-label="AI 이름 입력"
                      placeholder="새로운 AI 이름"
                    />
                    {aiNameError && <div style={{ color: '#d32f2f', fontSize: 16, marginBottom: 8 }}>{aiNameError}</div>}
                    <button
                      onClick={handleSaveAiName}
                      disabled={aiNameSaving}
                      style={{
                        background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)', color: '#fff', fontWeight: 700,
                        border: 'none', borderRadius: 22, padding: '18px 54px', fontSize: 20, marginTop: 2,
                        cursor: aiNameSaving ? 'not-allowed' : 'pointer', boxShadow: '0 6px 24px 0 rgba(120,180,255,0.15)',
                        letterSpacing: 1.5,
                      }}
                    >{aiNameSaving ? '저장 중...' : '이름 선물하기'}</button>
                    <button
                      onClick={() => setAiNameEditOpen(false)}
                      style={{ background: 'none', border: 'none', color: '#888', fontSize: 17, marginTop: 24, cursor: 'pointer', fontWeight: 500 }}
                    >취소</button>
                    <div style={{ fontSize: 15, color: '#888', marginTop: 36, textAlign: 'center', lineHeight: 1.6, letterSpacing: 0.2 }}>
                      세로에게 새 이름은 <span style={{ color: '#1976d2', fontWeight: 700 }}>선물</span>과 같아요.<br/>신중하게 지어주세요.
                    </div>
                  </div>
                  <style>{`@keyframes ai-name-popup-appear {from { opacity: 0; transform: translateY(40px) scale(0.97); }to { opacity: 1; transform: translateY(0) scale(1); }}`}</style>
                </div>
              )}
              {/* 태그(성격/감정표현) UI: tagEditMode가 true일 때만 전체 태그(활성/비활성) 모두 표시, false일 때는 선택된 태그만 표시 */}
              {tagEditMode ? (
                <>
                  {/* 분위기 태그 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">분위기 <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>(최대 2개)</span></div>
                    <div className="persona-tags-list profile-page-tags" style={{ marginBottom: 2 }}>
                      {allTags.filter(t => t.category === '대형').map(tag => (
                        <span
                          key={tag.name}
                          className={`persona-tag ${personaTags.includes(tag.name) ? 'active' : 'inactive'}`}
                          onClick={() => {
                            if (!tagEditMode) return;
                            console.log('=== 태그 클릭 이벤트 ===');
                            console.log('클릭된 태그:', tag.name);
                            console.log('현재 태그 상태:', personaTags);
                            console.log('tagEditMode:', tagEditMode);
                            
                            const isActive = personaTags.includes(tag.name);
                            let nextTags = [...personaTags];
                            const mainCount = allTags.filter(t => t.category === '대형' && nextTags.includes(t.name)).length;
                            
                            console.log('태그 활성 상태:', isActive);
                            console.log('대형 카테고리 개수:', mainCount);
                            
                            if (isActive) {
                              if (mainCount <= 1) {
                                console.log('최소 1개 유지 - 제거 불가');
                                return;
                              }
                              nextTags = nextTags.filter(t => t !== tag.name);
                              console.log('태그 제거됨');
                            } else {
                              if (mainCount >= 2) {
                                console.log('최대 2개 초과 - 추가 불가');
                                return;
                              }
                              nextTags.push(tag.name);
                              console.log('태그 추가됨');
                            }
                            
                            console.log('새로운 태그 배열:', nextTags);
                            setPersonaTags(nextTags);
                            
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { personaTags: nextTags }, { merge: true });
                              console.log('Firestore에 저장 완료');
                            }
                            console.log('========================');
                          }}
                          style={{ pointerEvents: tagEditMode ? 'auto' : 'none' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 성격 태그 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">성격 <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>(최대 4개)</span></div>
                    <div className="persona-tags-list profile-page-tags" style={{ marginBottom: 2 }}>
                      {allTags.filter(t => t.category === '유형').map(tag => (
                        <span
                          key={tag.name}
                          className={`persona-tag ${personaTags.includes(tag.name) ? 'active' : 'inactive'}`}
                          onClick={() => {
                            if (!tagEditMode) return;
                            console.log('=== 성격 태그 클릭 이벤트 ===');
                            console.log('클릭된 성격 태그:', tag.name);
                            console.log('현재 태그 상태:', personaTags);
                            console.log('tagEditMode:', tagEditMode);
                            
                            const isActive = personaTags.includes(tag.name);
                            let nextTags = [...personaTags];
                            const typeCount = allTags.filter(t => t.category === '유형' && nextTags.includes(t.name)).length;
                            
                            console.log('태그 활성 상태:', isActive);
                            console.log('유형 카테고리 개수:', typeCount);
                            
                            if (isActive) {
                              if (typeCount <= 1) {
                                console.log('최소 1개 유지 - 제거 불가');
                                return;
                              }
                              nextTags = nextTags.filter(t => t !== tag.name);
                              console.log('성격 태그 제거됨');
                            } else {
                              if (typeCount >= 4) {
                                console.log('최대 4개 초과 - 추가 불가');
                                return;
                              }
                              nextTags.push(tag.name);
                              console.log('성격 태그 추가됨');
                            }
                            
                            console.log('새로운 태그 배열:', nextTags);
                            setPersonaTags(nextTags);
                            
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { personaTags: nextTags }, { merge: true });
                              console.log('Firestore에 성격 태그 저장 완료');
                            }
                            console.log('========================');
                          }}
                          style={{ pointerEvents: tagEditMode ? 'auto' : 'none' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 감정표현 태그 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">감정표현 <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>(최대 4개)</span></div>
                    <div className="persona-tags-list profile-page-tags">
                      {expressionPresets.map(preset => (
                        <span
                          key={preset.key}
                          className={`persona-tag expr-preset ${expressionPrefs.includes(preset.key) ? 'active' : 'inactive'}`}
                          onClick={() => {
                            if (!tagEditMode) return;
                            console.log('=== 감정표현 태그 클릭 이벤트 ===');
                            console.log('클릭된 감정표현:', preset.key, preset.label);
                            console.log('현재 감정표현 상태:', expressionPrefs);
                            console.log('tagEditMode:', tagEditMode);
                            
                            let next = [...expressionPrefs];
                            const isActive = next.includes(preset.key);
                            
                            console.log('감정표현 활성 상태:', isActive);
                            console.log('현재 감정표현 개수:', next.length);
                            
                            if (isActive) {
                              if (next.length <= 1) {
                                console.log('최소 1개 유지 - 제거 불가');
                                return;
                              }
                              next = next.filter(k => k !== preset.key);
                              console.log('감정표현 제거됨');
                            } else {
                              if (next.length >= 4) {
                                console.log('최대 4개 초과 - 추가 불가');
                                return;
                              }
                              next.push(preset.key);
                              console.log('감정표현 추가됨');
                            }
                            
                            console.log('새로운 감정표현 배열:', next);
                            setExpressionPrefs(next);
                            
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { expressionPrefs: next }, { merge: true });
                              console.log('Firestore에 감정표현 저장 완료');
                            }
                            console.log('========================');
                          }}
                          style={{ pointerEvents: tagEditMode ? 'auto' : 'none', minWidth: 120, justifyContent: 'center', display: 'flex', alignItems: 'center' }}
                        >
                          {preset.label} <span style={{ marginLeft: 8, fontSize: 18 }}>{preset.example}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* TMT(Too Much Talker) 비율 슬라이더 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">답변 길이 <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>(TMT 비율)</span></div>
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: '#666' }}>간결</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1976d2' }}>{tmtRatio}%</span>
                        <span style={{ fontSize: 13, color: '#666' }}>자세</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={tmtRatio}
                        onChange={(e) => handleUpdateTmtRatio(Number(e.target.value))}
                        disabled={!tagEditMode}
                        className="tmt-slider"
                        style={{
                          opacity: tagEditMode ? 1 : 0.5,
                          cursor: tagEditMode ? 'pointer' : 'not-allowed',
                        }}
                      />
                      <div className="tmt-slider-labels">
                        <span>한 문장</span>
                        <span>적당</span>
                        <span>매우 자세</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 재설정 비활성화 시에는 선택된 태그만 보여줌 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">분위기</div>
                    <div className="persona-tags-list profile-page-tags" style={{ marginBottom: 2 }}>
                      {allTags.filter(t => t.category === '대형' && personaTags.includes(t.name)).map(tag => (
                        <span key={tag.name} className="persona-tag active" style={{ pointerEvents: 'none' }}>{tag.name}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">성격</div>
                    <div className="persona-tags-list profile-page-tags" style={{ marginBottom: 2 }}>
                      {allTags.filter(t => t.category === '유형' && personaTags.includes(t.name)).map(tag => (
                        <span key={tag.name} className="persona-tag active" style={{ pointerEvents: 'none' }}>{tag.name}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">감정표현</div>
                    <div className="persona-tags-list profile-page-tags">
                      {expressionPresets.filter(preset => expressionPrefs.includes(preset.key)).map(preset => (
                        <span key={preset.key} className="persona-tag expr-preset active" style={{ pointerEvents: 'none', minWidth: 120, justifyContent: 'center', display: 'flex', alignItems: 'center' }}>{preset.label} <span style={{ marginLeft: 8, fontSize: 18 }}>{preset.example}</span></span>
                      ))}
                    </div>
                  </div>
                  {/* TMT 비율 표시 (비활성화 모드) */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">답변 길이</div>
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: '#666' }}>간결</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1976d2' }}>{tmtRatio}%</span>
                        <span style={{ fontSize: 13, color: '#666' }}>자세</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={tmtRatio}
                        disabled={true}
                        className="tmt-slider"
                        style={{
                          opacity: 0.5,
                          cursor: 'not-allowed',
                        }}
                      />
                      <div className="tmt-slider-labels">
                        <span>한 문장</span>
                        <span>적당</span>
                        <span>매우 자세</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* 태그(성격/감정표현) UI 아래에 버튼 조건부 렌더링 */}
              {tagEditMode ? (
                <button className="profile-reset-btn" style={{ marginTop: 18 }} onClick={() => setTagEditMode(false)}>재설정 완료</button>
              ) : (
                <button className="profile-reset-btn" style={{ marginTop: 32 }} onClick={() => setTagEditMode(true)}>성격 재설정</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;