import React, { useState, useRef, FormEvent, useEffect } from 'react';
import './App.css';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, getDoc, setDoc, onSnapshot, updateDoc, limit, startAfter } from 'firebase/firestore';
import AuthForm from './AuthForm';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ParticleAvatar, ChatMessage, ProfileModal, ChatInput } from './components';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useProfile } from './hooks/useProfile';
import { useGlobalSettings } from './hooks/useGlobalSettings';
import { useRelations } from './hooks/useRelations';

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

// ParticleAvatar 컴포넌트는 이제 별도 파일로 분리됨

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // TMT(Too Much Talker) 비율 상태 추가
  const [tmtRatio, setTmtRatio] = useState<number>(50); // 0-100, 기본값 50

  // ProfileModal 관련 상태들은 이제 ProfileModal 컴포넌트 내부에서 관리됨

  // 캐릭터 프로필 상태 추가 (성별, 직업, 설명)
  const [characterProfile, setCharacterProfile] = useState({
    gender: '',
    job: '',
    description: ''
  });

  // 캐릭터 자동생성 로딩/에러 상태
  const [characterGenLoading, setCharacterGenLoading] = useState(false);
  const [characterGenError, setCharacterGenError] = useState('');

  // 캐릭터 정보 자동생성 함수
  const handleAutoGenerateCharacter = async () => {
    setCharacterGenLoading(true);
    setCharacterGenError('');
    try {
      // 프롬프트 구성: 현재 페르소나 태그/감정표현을 기반으로 캐릭터 정보 생성 요청
      const tagCategories = getTagsByCategory(personaTags);
      const exprLabels = getExpressionLabels(expressionPrefs);
      let tagDesc = Object.entries(tagCategories)
        .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
        .join(' / ');
      if (!tagDesc) tagDesc = '없음';
      const exprDesc = exprLabels.length > 0 ? exprLabels.join(', ') : '없음';
      const prompt =
        `아래와 같은 성격/감정표현 조합을 가진 가상의 인물(캐릭터)을 만들어줘.\n` +
        `성격/분위기 태그: ${tagDesc}\n` +
        `감정표현 방식: ${exprDesc}\n` +
        `아래 형식으로 답변해.\n` +
        `성별: (예: 남성/여성/미정)\n직업: (예: 대학생/디자이너/미정)\n설명: (한 문장으로 간단히)`;
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '캐릭터 정보를 생성해줘. 매번 다르게 만들어줘.' }
        ],
        temperature: 0.9 // 다양성 증가
      });
      const aiText = res.choices[0].message?.content || '';
      // 응답 파싱 (성별/직업/설명)
      const genderMatch = aiText.match(/성별\s*[:：]\s*(.*)/);
      const jobMatch = aiText.match(/직업\s*[:：]\s*(.*)/);
      const descMatch = aiText.match(/설명\s*[:：]\s*(.*)/);
      setCharacterProfile({
        gender: genderMatch ? genderMatch[1].trim() : '',
        job: jobMatch ? jobMatch[1].trim() : '',
        description: descMatch ? descMatch[1].trim() : ''
      });
    } catch (err) {
      setCharacterGenError('캐릭터 자동생성 중 오류가 발생했습니다.');
    }
    setCharacterGenLoading(false);
  };

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
      if (snap.exists()) {
        const data = snap.data();
        setPersonaTags(data.personaTags || []);
        setExpressionPrefs(data.expressionPrefs || []);
        setTmtRatio(data.tmtRatio || 50);
      } else {
        // 최초 로그인 시 기본값 저장
        const defaultTags = ['유쾌함', '진지함'];
        await setDoc(profileRef, { personaTags: defaultTags, expressionPrefs: [], tmtRatio: 50 });
        setPersonaTags(defaultTags);
        setExpressionPrefs([]);
        setTmtRatio(50);
      }
    };
    fetchTags();
  }, [user]);

  // 태그/감정표현 변경 시 Firestore에 저장
  const handleUpdateTags = async (tags: string[]) => {
    setPersonaTags(tags);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { personaTags: tags }, { merge: true });
    }
  };
  const handleUpdateExpressionPrefs = async (prefs: string[]) => {
    setExpressionPrefs(prefs);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { expressionPrefs: prefs }, { merge: true });
    }
  };

  // TMT 비율 업데이트 함수
  const handleUpdateTmtRatio = async (ratio: number) => {
    setTmtRatio(ratio);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, { tmtRatio: ratio }, { merge: true });
    }
  };

  // 글로벌 세로 지침 상태
  const [seroGuideline, setSeroGuideline] = useState('');
  const [seroGuidelineLoading, setSeroGuidelineLoading] = useState(true);

  // Firestore에서 글로벌 세로 지침 불러오기
  useEffect(() => {
    const fetchGuideline = async () => {
      setSeroGuidelineLoading(true);
      try {
        const guidelineRef = doc(db, 'global', 'sero_guideline');
        const snap = await getDoc(guidelineRef);
        if (snap.exists()) {
          const data = snap.data();
          setSeroGuideline(data.guideline || '');
        } else {
          setSeroGuideline('');
        }
      } catch (e) {
        setSeroGuideline('');
      }
      setSeroGuidelineLoading(false);
    };
    fetchGuideline();
  }, []);

  // 사용자/세로 관계도 상태
  const [userRelations, setUserRelations] = useState<any>(null);
  const [seroRelations, setSeroRelations] = useState<any>(null);
  const [relationsLoading, setRelationsLoading] = useState(true);

  // Firestore에서 관계도 불러오기
  useEffect(() => {
    if (!user) return;
    setRelationsLoading(true);
    const fetchRelations = async () => {
      try {
        const userRef = doc(db, 'users', user.uid, 'relations', 'user');
        const seroRef = doc(db, 'users', user.uid, 'relations', 'sero');
        const userSnap = await getDoc(userRef);
        const seroSnap = await getDoc(seroRef);
        setUserRelations(userSnap.exists() ? userSnap.data() : null);
        setSeroRelations(seroSnap.exists() ? seroSnap.data() : null);
      } catch (e) {
        setUserRelations(null);
        setSeroRelations(null);
      }
      setRelationsLoading(false);
    };
    fetchRelations();
  }, [user]);

  // 관계도 요약 텍스트 생성 함수
  function getRelationsSummary() {
    let summary = '';
    if (userRelations && userRelations.relations && Array.isArray(userRelations.relations)) {
      summary += '[사용자 관계도]\n';
      userRelations.relations.forEach((rel: any) => {
        summary += `${rel.name}(${rel.type}): ${rel.desc || ''}`;
        if (rel.episodes && rel.episodes.length > 0) {
          summary += `, 에피소드: ${rel.episodes.join('; ')}`;
        }
        summary += '\n';
      });
    }
    if (seroRelations && (seroRelations.characters || seroRelations.places)) {
      summary += '[세로의 가상 관계도]\n';
      if (seroRelations.characters && Array.isArray(seroRelations.characters)) {
        seroRelations.characters.forEach((char: any) => {
          summary += `${char.name}(${char.relation}): ${char.desc || ''}`;
          if (char.episodes && char.episodes.length > 0) {
            summary += `, 에피소드: ${char.episodes.join('; ')}`;
          }
          summary += '\n';
        });
      }
      if (seroRelations.places && Array.isArray(seroRelations.places)) {
        seroRelations.places.forEach((place: any) => {
          summary += `공간: ${place.name} - ${place.desc || ''}\n`;
        });
      }
    }
    return summary.trim();
  }

  // 시스템 프롬프트 생성 함수 (관계도 요약 포함)
  const updateSystemPrompt = (
    tags: string[],
    exprs: string[],
    tmt: number,
    charProf = characterProfile,
    nickname = userProfile?.nickname || '사용자',
    guideline = seroGuideline
  ) => {
    const aiName = aiProfile?.name || '세로';
    const userName = nickname;
    // 유효한 태그만 사용
    const validTags = tags.filter(tag => allTags.some(t => t.name === tag));
    const validExprs = exprs.filter(expr => expressionPresets.some(p => p.key === expr));
    const tagCategories = getTagsByCategory(validTags);
    const exprLabels = getExpressionLabels(validExprs);
    let tagDesc = Object.entries(tagCategories)
      .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
      .join(' / ');
    if (!tagDesc) tagDesc = '없음';
    const exprDesc = exprLabels.length > 0 ? exprLabels.join(', ') : '없음';
    let tmtInstruction = '';
    if (tmt <= 20) {
      tmtInstruction = '매우 간결하게 답변해. 한 문장으로 끝내는 것을 선호해.';
    } else if (tmt <= 40) {
      tmtInstruction = '간결하게 답변해. 2-3문장 정도로 답변해.';
    } else if (tmt <= 60) {
      tmtInstruction = '적당한 길이로 답변해. 3-5문장 정도로 답변해.';
    } else if (tmt <= 80) {
      tmtInstruction = '자세하게 답변해. 5-8문장 정도로 답변해.';
    } else {
      tmtInstruction = '매우 자세하게 답변해. 8문장 이상으로 상세하게 설명해.';
    }
    // 캐릭터 프로필 설명 추가
    let charProfileDesc = '';
    if (charProf.gender || charProf.job || charProf.description) {
      charProfileDesc = `\n[캐릭터 정보]\n성별: ${charProf.gender || '미정'}\n직업: ${charProf.job || '미정'}\n설명: ${charProf.description || '없음'}`;
    }
    // 관계도 요약 추가
    const relationsSummary = getRelationsSummary();

    // 현재 시간 한글 포맷 + 타임존 (가장 최근 메시지 createdAt 기준)
    let date = new Date();
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.createdAt && typeof lastMessage.createdAt.toDate === 'function') {
        date = lastMessage.createdAt.toDate();
      } else if (lastMessage.createdAt instanceof Date) {
        date = lastMessage.createdAt;
      }
    }
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -date.getTimezoneOffset() / 60;
    const offsetStr = (offset >= 0 ? '+' : '') + offset;
    const hour = date.getHours();
    const ampm = hour < 12 ? '오전' : '오후';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const nowStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]}) ${ampm} ${hour12}시 ${date.getMinutes()}분 (${tz}, GMT${offsetStr})`;

    // 시간+스케줄 고려 안내 추가
    const timeInstruction = `지금은 ${nowStr}입니다. 반드시 현재 시간과 너의 직업, 라이프스타일, 스케줄을 고려해서 답변해. 예를 들어 네가 회사원이라면 점심시간엔 점심을 먹고 있다거나, 바텐더라면 새벽에 일하고 오전엔 자고 있다거나, 학생이면 수업 중일 수 있다는 식으로, 시간대와 네 페르소나의 일상/스케줄을 자연스럽게 반영해서 답변해.`;

    const prompt =
      (guideline ? `[세로의 기본 지침]\n${guideline}\n\n` : '') +
      (relationsSummary ? relationsSummary + '\n\n' : '') +
      `너는 감정형 페르소나 AI야. 네 이름은 "${aiName}"이고, 사용자의 닉네임은 "${userName}"이야.\n` +
      `항상 본인 이름으로 자신을 지칭하고, 사용자를 부를 때는 "${userName}"이라고 불러.\n` +
      `다음과 같은 성격과 감정표현 방식을 가지고 있어.\n` +
      `성격/분위기 태그: ${tagDesc}\n` +
      `감정표현 방식: ${exprDesc}\n` +
      `답변 길이: ${tmtInstruction}${charProfileDesc}\n` +
      `${timeInstruction}\n` +
      `항상 위의 성격과 감정표현을 유지해서 자연스럽고 일관성 있게 답변해. (태그/감정표현/캐릭터 정보/관계도가 바뀌면 그에 맞게 말투와 분위기도 바뀌어야 해.)`;
    setSystemPrompt(prompt);
    return prompt;
  };

  // 대화 카운트 상태
  const [messageExtractCount, setMessageExtractCount] = useState(0);
  const [messageExtractThreshold, setMessageExtractThreshold] = useState(2); // 기본값 2

  // Firestore에서 global/relation_count/count 불러오기
  useEffect(() => {
    const fetchRelationCount = async () => {
      try {
        const countRef = doc(db, 'global', 'relation_count');
        const snap = await getDoc(countRef);
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.count === 'number' && data.count > 0) {
            setMessageExtractThreshold(data.count);
          }
        }
      } catch (e) {
        // 실패 시 기본값 유지
      }
    };
    fetchRelationCount();
  }, []);

  // 대화 카운트 증가 및 threshold마다 관계/자아 추출
  const incrementMessageExtractCount = async () => {
    if (!user) return;
    const newCount = messageExtractCount + 1;
    setMessageExtractCount(newCount);
    const metaRef = doc(db, 'users', user.uid, 'meta', 'main');
    await setDoc(metaRef, { messageExtractCount: newCount }, { merge: true });
    if (newCount >= messageExtractThreshold) {
      // Firestore에서 최근 threshold개 메시지 불러오기
      const messagesRef = collection(db, 'chats', user.uid, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(messageExtractThreshold));
      const snapshot = await getDocs(q);
      const recentMessages = snapshot.docs.map(doc => doc.data()).reverse();
      // GPT 프롬프트 구성
      const chatText = recentMessages.map((m, i) => `${i + 1}. ${m.sender === 'user' ? '사용자' : '세로'}: ${m.text}`).join('\n');
      const prompt = `아래는 최근 대화 내용입니다.\n\n[대화]\n${chatText}\n\n[요청]\n- 사용자와 세로의 대화에서 등장한 인물, 관계, 사건, 공간을 각각 분류해서 JSON으로 정리해줘.\n- 세로가 말한 자기서사/세계관(자아 정보)은 별도로 정리해줘.\n\n[출력 예시]\n{\n  "userRelations": [\n    { "name": "엄마", "type": "가족", "desc": "밥을 먹음", "episodes": ["밥 먹음"] }\n  ],\n  "seroRelations": [\n    { "name": "로라", "relation": "친구", "desc": "항상 도와줌", "episodes": ["도와줌"] }\n  ],\n  "seroIdentity": {\n    "places": [ { "name": "별빛마을", "desc": "세로가 자란 곳" } ],\n    "events": [],\n    "selfNarrative": ["나는 별빛마을에서 자랐어"]\n  }\n}`;
      try {
        const res = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'JSON만 정확하게 출력해줘.' }
          ],
          temperature: 0.2
        });
        const aiText = res.choices[0].message?.content || '';
        console.log('GPT 응답:', aiText); // 디버그
        // JSON 파싱
        let extracted;
        try {
          extracted = JSON.parse(aiText.replace(/```json|```/g, '').trim());
        } catch (e) {
          console.log('JSON 파싱 실패:', e, aiText); // 디버그
          extracted = null;
        }
        console.log('파싱 결과:', extracted); // 디버그
        if (extracted) {
          // 1. 사용자 관계도
          if ((Array.isArray(extracted.userRelations) && extracted.userRelations.length > 0) || (Array.isArray(extracted.seroRelations) && extracted.seroRelations.length > 0)) {
            const relationsRef = doc(db, 'relations', user.uid, 'main', 'data');
            const relationsSnap = await getDoc(relationsRef);
            let prevUser = relationsSnap.exists() && Array.isArray(relationsSnap.data().userRelations) ? relationsSnap.data().userRelations : [];
            let prevSero = relationsSnap.exists() && Array.isArray(relationsSnap.data().seroRelations) ? relationsSnap.data().seroRelations : [];

            // 첫 저장 시 '비어있음' 데이터 모두 제거
            if (prevUser.length === 1 && prevUser[0].name === "비어있음") prevUser = [];
            if (prevSero.length === 1 && prevSero[0].name === "비어있음") prevSero = [];

            // 사용자 관계 누적 (동일 인물+관계면 에피소드만 추가)
            if (Array.isArray(extracted.userRelations)) {
              extracted.userRelations.forEach((rel: any) => {
                const idx = prevUser.findIndex((r: any) => r.name === rel.name && r.type === rel.type);
                if (idx >= 0) {
                  prevUser[idx].episodes = Array.isArray(prevUser[idx].episodes) ? prevUser[idx].episodes : [];
                  rel.episodes = Array.isArray(rel.episodes) ? rel.episodes : [];
                  prevUser[idx].episodes = Array.from(new Set([...prevUser[idx].episodes, ...rel.episodes]));
                  if (rel.desc) prevUser[idx].desc = rel.desc;
                } else {
                  prevUser.push(rel);
                }
              });
            }

            // 세로 관계 누적 (동일 인물+관계면 에피소드만 추가)
            if (Array.isArray(extracted.seroRelations)) {
              extracted.seroRelations.forEach((rel: any) => {
                const idx = prevSero.findIndex((r: any) => r.name === rel.name && r.relation === rel.relation);
                if (idx >= 0) {
                  prevSero[idx].episodes = Array.isArray(prevSero[idx].episodes) ? prevSero[idx].episodes : [];
                  rel.episodes = Array.isArray(rel.episodes) ? rel.episodes : [];
                  prevSero[idx].episodes = Array.from(new Set([...prevSero[idx].episodes, ...rel.episodes]));
                  if (rel.desc) prevSero[idx].desc = rel.desc;
                } else {
                  prevSero.push(rel);
                }
              });
            }

            try {
              console.log('Firestore 저장(관계도 통합) 직전:', { userRelations: prevUser, seroRelations: prevSero });
              await setDoc(relationsRef, { userRelations: prevUser, seroRelations: prevSero }, { merge: true });
              console.log('Firestore 저장(관계도 통합) 완료');
            } catch (e) {
              console.log('Firestore 저장(관계도 통합) 에러:', e);
            }
          }
          // 2. 세로 자아(세계관)
          if (extracted.seroIdentity) {
            const profileRef = doc(db, 'users', user.uid, 'profile', 'main');
            const profileSnap = await getDoc(profileRef);
            let prevPlaces = profileSnap.exists() && Array.isArray(profileSnap.data().places) ? profileSnap.data().places : [];
            let prevEvents = profileSnap.exists() && Array.isArray(profileSnap.data().events) ? profileSnap.data().events : [];
            let prevNarr = profileSnap.exists() && Array.isArray(profileSnap.data().selfNarrative) ? profileSnap.data().selfNarrative : [];
            if (Array.isArray(extracted.seroIdentity.places)) {
              extracted.seroIdentity.places.forEach((place: any) => {
                if (!prevPlaces.find((p: any) => p.name === place.name)) prevPlaces.push(place);
              });
            }
            if (Array.isArray(extracted.seroIdentity.events)) {
              extracted.seroIdentity.events.forEach((ev: any) => {
                if (!prevEvents.find((e: any) => e.name === ev.name)) prevEvents.push(ev);
              });
            }
            if (Array.isArray(extracted.seroIdentity.selfNarrative)) {
              extracted.seroIdentity.selfNarrative.forEach((narr: string) => {
                if (!prevNarr.includes(narr)) prevNarr.push(narr);
              });
            }
            try {
              console.log('Firestore 저장(세로 자아, profile/main) 직전:', { places: prevPlaces, events: prevEvents, selfNarrative: prevNarr });
              await setDoc(profileRef, { places: prevPlaces, events: prevEvents, selfNarrative: prevNarr }, { merge: true });
              console.log('Firestore 저장(세로 자아, profile/main) 완료');
            } catch (e) {
              console.log('Firestore 저장(세로 자아, profile/main) 에러:', e);
            }
          }
        }
      } catch (err) {
        console.log('GPT 호출/전체 에러:', err); // 디버그
      }
      // 카운트 0으로 초기화
      setMessageExtractCount(0);
      await setDoc(metaRef, { messageExtractCount: 0 }, { merge: true });
    }
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
      // system prompt 동적 생성 (characterProfile, nickname, 글로벌 지침, 관계도 항상 반영)
      const prompt = updateSystemPrompt(personaTags, expressionPrefs, tmtRatio, characterProfile, userProfile?.nickname || '사용자', seroGuideline);
      const chatMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: prompt },
        ...messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }) as { role: 'user' | 'assistant'; content: string }),
        { role: 'user', content: input } as { role: 'user'; content: string },
      ];
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
      });
      const aiText = res.choices[0].message?.content || '';
      await addAiMessagesWithDelay(aiText);
    } catch (err) {
      await addAiMessagesWithDelay('오류가 발생했습니다.');
    }
    setLoading(false);
    // 대화 카운트 증가 및 threshold마다 관계/자아 추출
    await incrementMessageExtractCount();
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
  const handleSaveAiName = async (aiNameInput: string) => {
    if (!user) return '';
    if (aiNameInput.trim() === '') return '';
    const userRef = doc(db, 'users', user.uid);
    const profileRef = doc(userRef, 'profile', 'main');
    await setDoc(profileRef, { name: aiNameInput }, { merge: true });
    setAiProfile({ name: aiNameInput });
    return aiNameInput;
  };

  // 닉네임 저장도 profile/main에 저장 및 동기화
  // saveUserNickname 함수와 관련된 닉네임 상태/코드 전체 삭제

  // 1. 로그인 시 항상 최하단으로 스크롤
  useEffect(() => {
    if (user && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [user, messages]);

  // 세로 프로필 모달 내 태그 재설정 기능
  const [tagEditMode, setTagEditMode] = useState(false);

  // 시스템 프롬프트 상태 추가
  const [systemPrompt, setSystemPrompt] = useState('');

  // 프로필 재설정 완료 시 Firestore에 현재 값 저장
  const handleProfileResetComplete = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      await setDoc(profileRef, {
        personaTags,
        expressionPrefs,
        tmtRatio,
        characterGender: characterProfile.gender,
        characterJob: characterProfile.job,
        characterDescription: characterProfile.description
      }, { merge: true });
    }
    updateSystemPrompt(personaTags, expressionPrefs, tmtRatio, characterProfile);
    setTagEditMode(false);
  };

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

  // Firestore에서 캐릭터 프로필 불러오기
  useEffect(() => {
    if (!user) return;
    const fetchCharacterProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      const profileRef = doc(userRef, 'profile', 'main');
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data();
        setCharacterProfile({
          gender: data.characterGender || '',
          job: data.characterJob || '',
          description: data.characterDescription || ''
        });
      } else {
        setCharacterProfile({ gender: '', job: '', description: '' });
      }
    };
    fetchCharacterProfile();
  }, [user]);

  // Firestore에 relations/{uid}/main/data 문서가 없으면 '비어있음' 한글 기본값으로 초기화
  useEffect(() => {
    if (!user) return;
    const initRelations = async () => {
      const relationsRef = doc(db, 'relations', user.uid, 'main', 'data');
      const relationsSnap = await getDoc(relationsRef);
      if (!relationsSnap.exists()) {
        await setDoc(relationsRef, {
          userRelations: [{ name: "비어있음", type: "비어있음", desc: "비어있음", episodes: ["비어있음"] }],
          seroRelations: [{ name: "비어있음", relation: "비어있음", desc: "비어있음", episodes: ["비어있음"] }]
        });
        console.log('Firestore relations/{uid}/main/data 문서 "비어있음" 기본값으로 초기화 완료');
      }
    };
    initRelations();
  }, [user]);

  // textarea 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const minHeight = 44;
      if (!input) {
        textareaRef.current.style.height = minHeight + 'px';
      } else {
        textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, minHeight) + 'px';
      }
    }
  }, [input]);

  if (!user) {
    return <AuthForm onAuthSuccess={setUser} />;
  }

  return (
    <>
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
                  <div style={{ fontWeight: 700, color: '#1976d2', fontSize: 20, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {userProfile?.nickname || '사용자'}
                  </div>
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
                <ParticleAvatar size={38} particleCount={540} />
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
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={idx} 
                message={msg} 
                aiName={aiProfile?.name || '세로'} 
              />
            ))}
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
          <ChatInput 
            onSendMessage={async (message) => {
              // handleSend 함수의 로직을 여기서 실행
              if (!message.trim()) return;
              const userMsg = { sender: 'user' as const, text: message };
              setInput('');
              setLoading(true);
              setAiTyping(true);
              await saveMessage(userMsg);
              setTimeout(scrollToBottom, 200);
              try {
                // system prompt 동적 생성 (characterProfile, nickname, 글로벌 지침, 관계도 항상 반영)
                const prompt = updateSystemPrompt(personaTags, expressionPrefs, tmtRatio, characterProfile, userProfile?.nickname || '사용자', seroGuideline);
                const chatMessages: ChatCompletionMessageParam[] = [
                  { role: 'system', content: prompt },
                  ...messages.map(m => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: m.text,
                  }) as { role: 'user' | 'assistant'; content: string }),
                  { role: 'user', content: message } as { role: 'user'; content: string },
                ];
                const res = await openai.chat.completions.create({
                  model: 'gpt-4o',
                  messages: chatMessages,
                });
                const aiText = res.choices[0].message?.content || '';
                await addAiMessagesWithDelay(aiText);
              } catch (err) {
                await addAiMessagesWithDelay('오류가 발생했습니다.');
              }
              setLoading(false);
              // 대화 카운트 증가 및 threshold마다 관계/자아 추출
              await incrementMessageExtractCount();
            }}
            isTyping={aiTyping}
            disabled={loading}
          />
        </div>
      </div>
      <ProfileModal
        isOpen={profileOpen}
        onClose={handleProfileClose}
        aiProfile={aiProfile}
        personaTags={personaTags}
        expressionPrefs={expressionPrefs}
        tmtRatio={tmtRatio}
        characterProfile={characterProfile}
        characterGenLoading={characterGenLoading}
        characterGenError={characterGenError}
        onUpdateTags={handleUpdateTags}
        onUpdateExpressionPrefs={handleUpdateExpressionPrefs}
        onUpdateTmtRatio={handleUpdateTmtRatio}
        onAutoGenerateCharacter={handleAutoGenerateCharacter}
        onUpdateCharacterProfile={(profile) => setCharacterProfile(prev => ({ ...prev, ...profile }))}
        onUpdateAiName={handleSaveAiName}
      />
    </>
  );
}

export default App;