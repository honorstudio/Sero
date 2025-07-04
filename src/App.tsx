import React, { useState, useRef, FormEvent, useEffect } from 'react';
import './App.css';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, getDoc, setDoc, onSnapshot, updateDoc, limit, startAfter, where } from 'firebase/firestore';
import AuthForm from './AuthForm';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  createdAt?: any; // Firestore Timestamp 또는 Date
}

interface Persona {
  id: string;
  name: string;
  personaTags: string[];
  expressionPrefs: string[];
  tmtRatio: number;
  characterGender: string;
  characterJob: string;
  characterDescription: string;
  createdAt?: any;
  updatedAt?: any;
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
const ParticleAvatar: React.FC<{ size?: number; particleCount?: number }> = ({ size = 38, particleCount = 540 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fastTarget = useRef(1);
  const fastValue = useRef(1);
  const colorLerpValue = useRef(0);
  const [_, setRerender] = React.useState(0);
  const [glow, setGlow] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [outerGlow, setOuterGlow] = React.useState(false);

  // 활성화 상태에 따라 파티클 수 결정
  const activeParticleCount = hovered || glow ? Math.floor(particleCount / 2) : particleCount;
  // 파티클 배열 useState로 관리
  const [particles, setParticles] = React.useState<any[]>([]);

  // 캔버스 관련 값 useRef로 관리
  const cxRef = useRef(0);
  const cyRef = useRef(0);
  const rRef = useRef(0);

  useEffect(() => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 1;
    cxRef.current = cx;
    cyRef.current = cy;
    rRef.current = r;
    setParticles(Array.from({ length: activeParticleCount }).map((_, i) => {
      const theta = (2 * Math.PI * i) / activeParticleCount;
      // phase는 0~2PI 사이로만 약간 랜덤하게
      const phase = Math.random() * Math.PI * 2;
      return {
        baseX: cx,
        baseY: cy,
        angle: theta,
        baseRadius: r,
        targetRadius: r,
        currentRadius: r,
        phase,
      };
    }));
  }, [activeParticleCount, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    let running = true;
    function draw(t: number) {
      if (!ctx) return;
      fastValue.current += (fastTarget.current - fastValue.current) * 0.05;
      fastValue.current = Math.max(0.1, Math.min(1, fastValue.current));
      const colorTarget = hovered || glow ? 1 : 0;
      colorLerpValue.current += (colorTarget - colorLerpValue.current) * 0.08;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cxRef.current, cyRef.current, rRef.current, 0, 2 * Math.PI);
      ctx.clip();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let px, py;
        let particleRadius = 1;
        if (hovered || glow) {
          // 원형 테두리에 정확히 분포, 중앙 쪽으로만 살짝 튀는 효과
          const drumFreq = 0.0028; // 튀는 속도(30% 감소)
          const drumAmp = 4; // 튀는 세기 줄임
          const drum = Math.abs(Math.sin(t * drumFreq + p.phase)) * drumAmp;
          const targetRadius = rRef.current - drum;
          p.currentRadius += (targetRadius - p.currentRadius) * 0.028;
          px = cxRef.current + p.currentRadius * Math.cos(p.angle);
          py = cyRef.current + p.currentRadius * Math.sin(p.angle);
        } else {
          const θ = p.angle;
          const baseRadius = rRef.current * 0.7;
          const wave = Math.sin(t * 0.001 + θ * 3 + p.phase) * 12;
          let radius = baseRadius + wave;
          if (radius > rRef.current - 2) {
            p.phase += Math.random() * 0.5;
            radius = rRef.current - 2 - Math.abs(wave) * 0.5;
          }
          p.currentRadius += (radius - p.currentRadius) * 0.09;
          px = cxRef.current + p.currentRadius * Math.cos(θ);
          py = cyRef.current + p.currentRadius * Math.sin(θ);
        }
        const colorLerp = colorLerpValue.current;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const rC = Math.round(lerp(144, 25, colorLerp));
        const gC = Math.round(lerp(202, 118, colorLerp));
        const bC = Math.round(lerp(249, 210, colorLerp));
        const color = `rgba(${rC},${gC},${bC},0.95)`;
        ctx.beginPath();
        ctx.arc(px, py, particleRadius, 0, 2 * Math.PI);
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
    return () => { running = false; };
  }, [size, particles, hovered, glow]);

  // hover/typing 상태에 따라 targetRadius 변경
  const updateTarget = () => {
    for (let i = 0; i < particles.length; i++) {
      particles[i].targetRadius = (hovered || glow) ? rRef.current : particles[i].baseRadius;
    }
  };
  updateTarget();

  // 마우스 이벤트: 파티클 흩어짐/복귀, glow 효과
  const handleEnter = () => {
    setHovered(true);
    fastTarget.current = 0.01;
    setGlow(true);
    setOuterGlow(true);
  };
  const handleLeave = () => {
    setHovered(false);
    fastTarget.current = 2;
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
  // 1. 모든 useState, useRef, useEffect 등 Hook 선언 (조건문/return문보다 위)
  const [authInitializing, setAuthInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [tmtRatio, setTmtRatio] = useState<number>(50);
  const [userNickInput, setUserNickInput] = useState(userProfile?.nickname || '');
  const [userNickEdit, setUserNickEdit] = useState(false);
  const [userNickError, setUserNickError] = useState('');
  const [userNickSaving, setUserNickSaving] = useState(false);
  const [characterProfile, setCharacterProfile] = useState({ gender: '', job: '', description: '' });
  const [characterGenLoading, setCharacterGenLoading] = useState(false);
  const [characterGenError, setCharacterGenError] = useState('');
  const [showPersonaSelect, setShowPersonaSelect] = useState(true);
  
  // 누락된 상태 변수들 추가
  const [tagEditMode, setTagEditMode] = useState(false);
  const [aiNameInput, setAiNameInput] = useState('');
  const [aiNameEditOpen, setAiNameEditOpen] = useState(false);
  const [aiNameError, setAiNameError] = useState('');
  const [aiNameSaving, setAiNameSaving] = useState(false);

  // 2. useEffect 등 Hook 선언 (조건문/return문보다 위)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitializing(false);
      if (!currentUser) {
        setUserProfile(null);
        setAiProfile(null);
        setSelectedPersonaId(null);
        setPersonas([]);
        setShowPersonaSelect(true);
        setMessages([]);
        setInput('');
        setProfileOpen(false);
        setUserProfileOpen(false);
        setPersonaTags([]);
        setExpressionPrefs([]);
        setTmtRatio(50);
        setCharacterProfile({ gender: '', job: '', description: '' });
        setLastLoadedDoc(null);
        setHasMoreMessages(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 페르소나 데이터 로드
  useEffect(() => {
    if (!user) return;
    
    const personasCol = collection(db, 'users', user.uid, 'personas');
    const unsubscribe = onSnapshot(personasCol, (snapshot) => {
      const loaded: Persona[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '세로',
          personaTags: data.personaTags || [],
          expressionPrefs: data.expressionPrefs || [],
          tmtRatio: data.tmtRatio || 50,
          characterGender: data.characterGender || '',
          characterJob: data.characterJob || '',
          characterDescription: data.characterDescription || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      setPersonas(loaded);
      
      // 첫 번째 페르소나 자동 선택
      if (loaded.length > 0 && !selectedPersonaId) {
        setSelectedPersonaId(loaded[0].id);
      }
    });
    
    return () => unsubscribe();
  }, [user, selectedPersonaId]);

  // 선택된 페르소나의 프로필 데이터 로드
  useEffect(() => {
    if (!user || !selectedPersonaId) return;
    
    const personaRef = doc(db, 'users', user.uid, 'personas', selectedPersonaId);
    const unsubscribe = onSnapshot(personaRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPersonaTags(data.personaTags || []);
        setExpressionPrefs(data.expressionPrefs || []);
        setTmtRatio(data.tmtRatio || 50);
        setCharacterProfile({
          gender: data.characterGender || '',
          job: data.characterJob || '',
          description: data.characterDescription || ''
        });
      }
    });
    
    return () => unsubscribe();
  }, [user, selectedPersonaId]);

  // 사용자 프로필 데이터 로드
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    const profileRef = doc(userRef, 'profile', 'main');
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserProfile({
          nickname: data.nickname || '사용자',
          photoURL: data.photoURL
        });
        setAiProfile({
          name: data.aiName || '세로'
        });
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // 메시지 데이터 로드
  useEffect(() => {
    if (!user || !selectedPersonaId) return;
    
    const chatsCol = collection(db, 'chats', user.uid, 'messages');
    const q = query(
      chatsCol,
      where('personaId', '==', selectedPersonaId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sender: data.sender,
          text: data.text,
          createdAt: data.createdAt?.toDate() || new Date()
        };
      }).reverse();
      setMessages(loadedMessages);
    });
    
    return () => unsubscribe();
  }, [user, selectedPersonaId]);

  // 로그인 후 페르소나가 1개 이상 있으면 자동으로 선택화면 닫기
  useEffect(() => {
    if (user && personas.length > 0 && selectedPersonaId) {
      setShowPersonaSelect(false);
    }
  }, [user, personas, selectedPersonaId]);

  // 텍스트 영역 자동 높이 조정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // 메시지 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. 조건부 렌더링은 Hook 선언 이후에만 사용
  if (authInitializing) {
    return <div style={{width:'100vw',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:'#1976d2',background:'#f8fafc'}}>로딩 중...</div>;
  }
  if (!user) {
    return <AuthForm />;
  }



  // 새 페르소나 생성 함수
  const handleCreatePersona = async () => {
    if (!user || personas.length >= 3) return;
    const personasCol = collection(db, 'users', user.uid, 'personas');
    const newDoc = await addDoc(personasCol, {
      name: `세로 ${personas.length + 1}`,
      personaTags: [],
      expressionPrefs: [],
      tmtRatio: 50,
      characterGender: '',
      characterJob: '',
      characterDescription: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setSelectedPersonaId(newDoc.id);
    // 새로고침 없이 바로 반영되도록 fetchPersonas 재호출
    const snapshot = await getDocs(personasCol);
    const loaded: Persona[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '세로',
        personaTags: data.personaTags || [],
        expressionPrefs: data.expressionPrefs || [],
        tmtRatio: data.tmtRatio || 50,
        characterGender: data.characterGender || '',
        characterJob: data.characterJob || '',
        characterDescription: data.characterDescription || '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
    setPersonas(loaded);
  };

  // 페르소나 선택 핸들러
  const handleSelectPersona = (id: string) => {
    setSelectedPersonaId(id);
    setShowPersonaSelect(false);
    // 메시지 초기화 (새 페르소나의 메시지가 로드됨)
    setMessages([]);
    setLastLoadedDoc(null);
    setHasMoreMessages(true);
  };

  // 누락된 함수들 추가
  const handleProfileOpen = () => setProfileOpen(true);
  const handleProfileClose = () => setProfileOpen(false);
  const handleUserProfileOpen = () => setUserProfileOpen(true);
  const handleLogout = () => auth.signOut();
  
  const saveUserNickname = async () => {
    if (!user || !userNickInput.trim()) return;
    setUserNickSaving(true);
    setUserNickError('');
    try {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { nickname: userNickInput.trim() }, { merge: true });
      setUserProfile(prev => ({ ...prev, nickname: userNickInput.trim() }));
      setUserNickEdit(false);
    } catch (error) {
      setUserNickError('닉네임 저장에 실패했습니다.');
    } finally {
      setUserNickSaving(false);
    }
  };

  const handleSaveAiName = async () => {
    if (!user || !aiNameInput.trim()) return;
    setAiNameSaving(true);
    setAiNameError('');
    try {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { aiName: aiNameInput.trim() }, { merge: true });
      setAiProfile(prev => ({ ...prev, name: aiNameInput.trim() }));
      setAiNameEditOpen(false);
    } catch (error) {
      setAiNameError('이름 저장에 실패했습니다.');
    } finally {
      setAiNameSaving(false);
    }
  };

  const handleUpdateTmtRatio = (value: number) => {
    setTmtRatio(value);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      setDoc(profileRef, { tmtRatio: value }, { merge: true });
    }
  };

  const handleAutoGenerateCharacter = async () => {
    if (!user) return;
    setCharacterGenLoading(true);
    setCharacterGenError('');
    try {
      // 간단한 자동 생성 로직 (실제로는 AI API 호출)
      const generated = {
        gender: ['남성', '여성', '미정'][Math.floor(Math.random() * 3)],
        job: ['대학생', '직장인', '프리랜서', '미정'][Math.floor(Math.random() * 4)],
        description: '밝고 외향적인 성격입니다.'
      };
      setCharacterProfile(generated);
      
      if (selectedPersonaId) {
        const personaRef = doc(db, 'users', user.uid, 'personas', selectedPersonaId);
        await updateDoc(personaRef, { 
          characterGender: generated.gender,
          characterJob: generated.job,
          characterDescription: generated.description,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      setCharacterGenError('캐릭터 생성에 실패했습니다.');
    } finally {
      setCharacterGenLoading(false);
    }
  };

  const handleProfileResetComplete = () => {
    setTagEditMode(false);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !selectedPersonaId) return;
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
    // 사용자 메시지 추가
    const newUserMessage: Message = {
      sender: 'user',
      text: userMessage,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      // Firestore에 메시지 저장
      const chatsCol = collection(db, 'chats', user.uid, 'messages');
      await addDoc(chatsCol, {
        ...newUserMessage,
        personaId: selectedPersonaId,
        createdAt: serverTimestamp()
      });
      
      // AI 응답 생성 (간단한 예시)
      setAiTyping(true);
      setTimeout(() => {
        const aiResponse: Message = {
          sender: 'ai',
          text: `안녕하세요! ${userMessage}에 대한 답변입니다.`,
          createdAt: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setAiTyping(false);
        
        // AI 응답도 Firestore에 저장
        addDoc(chatsCol, {
          ...aiResponse,
          personaId: selectedPersonaId,
          createdAt: serverTimestamp()
        });
      }, 1000);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatScroll = () => {
    if (!chatListRef.current) return;
    const { scrollTop } = chatListRef.current;
    lastScrollTop.current = scrollTop;
  };

  // 조건부 렌더링: 로그인 화면, 세로 선택 화면, 메인 채팅 화면
  if (!user) {
    return <AuthForm />;
  }

  if (showPersonaSelect) {
    return (
      <div className="messenger-container">
        <div className="messenger-content" style={{ position: 'relative' }}>
          {/* 세로 선택 화면 */}
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <h2 style={{ color: '#1976d2', fontSize: 24, fontWeight: 700, marginBottom: 32 }}>세로 선택</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 320, margin: '0 auto' }}>
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handleSelectPersona(persona.id)}
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '2px solid #e3eaf5',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    boxShadow: '0 4px 16px 0 rgba(31,38,135,0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                    e.currentTarget.style.borderColor = '#90caf9';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px 0 rgba(31,38,135,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                    e.currentTarget.style.borderColor = '#e3eaf5';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px 0 rgba(31,38,135,0.08)';
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#1976d2', fontSize: 18, marginBottom: 8 }}>{persona.name}</div>
                  <div style={{ color: '#666', fontSize: 14 }}>
                    {persona.personaTags.length > 0 ? persona.personaTags.slice(0, 3).join(', ') : '기본 설정'}
                  </div>
                </button>
              ))}
              {personas.length < 3 && (
                <button
                  onClick={handleCreatePersona}
                  style={{
                    background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)',
                    border: 'none',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 16,
                    boxShadow: '0 4px 16px 0 rgba(120,180,255,0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px 0 rgba(120,180,255,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px 0 rgba(120,180,255,0.3)';
                  }}
                >
                  + 새 세로 만들기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 메인 채팅 UI 렌더링 부분 상단에 좌측 상단 화살표 버튼 추가
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 세로 선택 화살표 버튼 */}
            <button
              onClick={() => setShowPersonaSelect(true)}
              aria-label="세로 선택"
              style={{
                background: 'none', 
                border: 'none', 
                borderRadius: '50%', 
                width: 32, 
                height: 32, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)', 
                transition: 'background 0.2s', 
                color: '#1976d2'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(144,202,249,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* 파티클 아바타 (세로 프로필 설정 버튼) */}
            <div className="profile-info" onClick={handleProfileOpen}>
              <div className="profile-avatar" style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: 'transparent', boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)' }}>
                <ParticleAvatar size={38} particleCount={540} />
              </div>
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
                  <div style={{ position: 'absolute', left: 12, top: 6, fontSize: 13, color: '#1976d2', fontWeight: 700, letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {aiProfile?.name || '세로'}
                  </div>
                )}
                <div className="chat-message-content" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
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
        <form className="chat-input-area" onSubmit={handleSend} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '0 0 32px 32px' }}>
          <button
            type="button"
            className="plus-btn"
            aria-label="더보기"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              fontSize: 24,
              color: '#222',
              fontWeight: 400,
              boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
            tabIndex={-1}
          >
            <span style={{fontWeight: 400, fontSize: 24, lineHeight: 1, color: '#222'}}>+</span>
          </button>
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
            maxLength={1000}
            autoFocus
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // 전송 안 함, 줄바꿈도 안 됨
              }
            }}
            style={{ resize: 'none', overflow: 'hidden', minHeight: 44 }}
          />
          <button className={`send-btn${input.trim() ? ' active' : ''}`} type="submit" disabled={loading || !input.trim()} aria-label="전송">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 13h12M15 9l4 4-4 4" stroke="#222" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
      {/* 세로(AI) 프로필 모달: messenger-container 최상위에 분리 */}
      {profileOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 300 }}>
          <div className="profile-page-overlay">
            <div className="profile-page-content"
              style={{
                background: 'rgba(255,255,255,0.98)',
                borderRadius: 32,
                boxShadow: '0 8px 32px 0 rgba(31,38,135,0.10)',
                minWidth: 320,
                maxWidth: '90vw',
                minHeight: 340,
                padding: '48px 36px 36px 36px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                animation: 'profile-slidein 0.5s cubic-bezier(0.4,0,0.2,1)',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
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
                            const isActive = personaTags.includes(tag.name);
                            let nextTags = [...personaTags];
                            const mainCount = allTags.filter(t => t.category === '대형' && nextTags.includes(t.name)).length;
                            if (isActive) {
                              if (mainCount <= 1) return; // 최소 1개
                              nextTags = nextTags.filter(t => t !== tag.name);
                            } else {
                              if (mainCount >= 2) return; // 최대 2개
                              nextTags.push(tag.name);
                            }
                            setPersonaTags(nextTags);
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { personaTags: nextTags }, { merge: true });
                            }
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
                            const isActive = personaTags.includes(tag.name);
                            let nextTags = [...personaTags];
                            const typeCount = allTags.filter(t => t.category === '유형' && nextTags.includes(t.name)).length;
                            if (isActive) {
                              if (typeCount <= 1) return; // 최소 1개
                              nextTags = nextTags.filter(t => t !== tag.name);
                            } else {
                              if (typeCount >= 4) return; // 최대 4개
                              nextTags.push(tag.name);
                            }
                            setPersonaTags(nextTags);
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { personaTags: nextTags }, { merge: true });
                            }
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
                            let next = [...expressionPrefs];
                            const isActive = next.includes(preset.key);
                            if (isActive) {
                              if (next.length <= 1) return; // 최소 1개
                              next = next.filter(k => k !== preset.key);
                            } else {
                              if (next.length >= 4) return; // 최대 4개
                              next.push(preset.key);
                            }
                            setExpressionPrefs(next);
                            if (user) {
                              const userRef = doc(db, 'users', user.uid);
                              const profileRef = doc(userRef, 'profile', 'main');
                              setDoc(profileRef, { expressionPrefs: next }, { merge: true });
                            }
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
                        <span>단답</span>
                        <span>적당</span>
                        <span>TMT</span>
                      </div>
                    </div>
                  </div>
                  {/* 캐릭터 프로필 입력란 추가 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">정보<span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>(직접 수정 가능)</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button type="button" onClick={handleAutoGenerateCharacter} disabled={characterGenLoading} style={{ marginBottom: 8, background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 14, padding: '8px 18px', fontSize: 15, cursor: characterGenLoading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px 0 rgba(120,180,255,0.07)' }}>
                        {characterGenLoading ? '생성 중...' : '자동생성'}
                      </button>
                      {characterGenError && <div style={{ color: '#d32f2f', fontSize: 15 }}>{characterGenError}</div>}
                      <input
                        type="text"
                        placeholder="성별 (예: 남성, 여성, 미정)"
                        value={characterProfile.gender}
                        onChange={e => {
                          const newGender = e.target.value;
                          setCharacterProfile(p => ({ ...p, gender: newGender }));
                          // 실시간으로 페르소나에 저장
                          if (user && selectedPersonaId) {
                            const personaRef = doc(db, 'users', user.uid, 'personas', selectedPersonaId);
                            updateDoc(personaRef, { 
                              characterGender: newGender,
                              updatedAt: new Date()
                            });
                          }
                        }}
                        style={{ padding: 8, borderRadius: 8, border: '1px solid #e3eaf5', fontSize: 15 }}
                      />
                      <input
                        type="text"
                        placeholder="직업 (예: 대학생, 디자이너, 미정)"
                        value={characterProfile.job}
                        onChange={e => {
                          const newJob = e.target.value;
                          setCharacterProfile(p => ({ ...p, job: newJob }));
                          // 실시간으로 페르소나에 저장
                          if (user && selectedPersonaId) {
                            const personaRef = doc(db, 'users', user.uid, 'personas', selectedPersonaId);
                            updateDoc(personaRef, { 
                              characterJob: newJob,
                              updatedAt: new Date()
                            });
                          }
                        }}
                        style={{ padding: 8, borderRadius: 8, border: '1px solid #e3eaf5', fontSize: 15 }}
                      />
                      <textarea
                        placeholder="간단한 설명 (예: 밝고 외향적인 성격의 대학생)"
                        value={characterProfile.description}
                        onChange={e => {
                          const newDescription = e.target.value;
                          setCharacterProfile(p => ({ ...p, description: newDescription }));
                          // 실시간으로 페르소나에 저장
                          if (user && selectedPersonaId) {
                            const personaRef = doc(db, 'users', user.uid, 'personas', selectedPersonaId);
                            updateDoc(personaRef, { 
                              characterDescription: newDescription,
                              updatedAt: new Date()
                            });
                          }
                        }}
                        style={{ padding: 8, borderRadius: 8, border: '1px solid #e3eaf5', fontSize: 15, minHeight: 48 }}
                      />
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
                  {/* 읽기 전용 캐릭터 정보 표시 */}
                  <div style={{ width: '100%', marginBottom: 10 }}>
                    <div className="profile-section-title">가상 캐릭터 정보</div>
                    <div style={{ color: '#1976d2', fontWeight: 500, fontSize: 15, marginBottom: 4 }}>
                      성별: {characterProfile.gender || '미정'}
                    </div>
                    <div style={{ color: '#1976d2', fontWeight: 500, fontSize: 15, marginBottom: 4 }}>
                      직업: {characterProfile.job || '미정'}
                    </div>
                    <div style={{ color: '#1976d2', fontWeight: 500, fontSize: 15 }}>
                      설명: {characterProfile.description || '없음'}
                    </div>
                  </div>
                </>
              )}
              {/* 태그(성격/감정표현) UI 아래에 버튼 조건부 렌더링 */}
              {tagEditMode ? (
                <button className="profile-reset-btn" style={{ marginTop: 18 }} onClick={handleProfileResetComplete}>재설정 완료</button>
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