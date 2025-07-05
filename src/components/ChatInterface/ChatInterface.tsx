import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatInput from '../ChatInput/ChatInput';
import ProfileModal from '../ProfileModal/ProfileModal';
import ParticleAvatar from '../ParticleAvatar/ParticleAvatar';
import { useChat } from '../../hooks/useChat';
import { useGlobalSettings } from '../../hooks/useGlobalSettings';
import { useAdminRole } from '../../hooks/useAdminRole';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { profileService } from '../../services/firebaseService';
import { UserProfile, Message } from '../../types';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { generateCharacterInfo, extractSelfNarrative } from '../../services/openaiService';
import { debugSystemPrompt, errorLog } from '../../utils/debugUtils';

interface ChatInterfaceProps {
  user: any;
  persona?: any;
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ user, persona }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [aiProfile, setAiProfile] = useState<{ name: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number | null>(null);
  const navigate = useNavigate();

  // 글로벌 설정 사용
  const { settings: globalSettings, loading: globalSettingsLoading } = useGlobalSettings();
  
  // 채팅 관련 훅 사용
  const {
    messages,
    loading,
    hasMoreMessages,
    loadingMore,
    saveMessage,
    loadMoreMessages
  } = useChat(user?.uid, persona?.id);

  // 페르소나별 설정 상태 관리
  const [personaTags, setPersonaTags] = useState<string[]>(persona?.tags || []);
  const [expressionPrefs, setExpressionPrefs] = useState<string[]>(persona?.expressionPrefs || []);
  const [tmtRatio, setTmtRatio] = useState<number>(persona?.tmtRatio || 50);
  const [characterProfile, setCharacterProfile] = useState(persona?.characterProfile || { gender: '', job: '', description: '' });
  const [characterGenLoading, setCharacterGenLoading] = useState(false);
  const [characterGenError, setCharacterGenError] = useState('');
  const [selfNarrative, setSelfNarrative] = useState<string[]>(persona?.selfNarrative || []); // 자아 정보 추가
  const [lastExtractCount, setLastExtractCount] = useState<number>(0); // 마지막 추출 시점의 메시지 수
  const [aiTyping, setAiTyping] = useState(false); // AI 타이핑 상태 직접 관리

  // 페르소나 데이터가 변경될 때 상태 업데이트
  useEffect(() => {
    if (persona) {
      setPersonaTags(persona.tags || []);
      setExpressionPrefs(persona.expressionPrefs || []);
      setTmtRatio(persona.tmtRatio || 50);
      setCharacterProfile(persona.characterProfile || { gender: '', job: '', description: '' });
      setSelfNarrative(persona.selfNarrative || []); // 자아 정보 업데이트
    }
  }, [persona]);

  // 자아 정보 추출 로직
  useEffect(() => {
    if (!globalSettings || !user || !persona || messages.length === 0) return;
    
    const extractInterval = globalSettings.system?.extractInterval || 10;
    const currentMessageCount = messages.length;
    
    // 추출 주기에 도달했는지 확인
    if (currentMessageCount >= lastExtractCount + extractInterval) {
      const extractSelfInfo = async () => {
        try {
          // 최근 대화 내용을 텍스트로 변환
          const recentMessages = messages.slice(-extractInterval);
          const chatText = recentMessages.map(msg => 
            `${msg.sender === 'user' ? '사용자' : persona.name}: ${msg.text}`
          ).join('\n');
          
          // 자아 정보 추출
          const newSelfNarrative = await extractSelfNarrative(chatText);
          
          if (newSelfNarrative.length > 0) {
            // 기존 자아 정보와 병합 (중복 제거)
            const combinedNarrative = Array.from(new Set([...selfNarrative, ...newSelfNarrative]));
            
            // 최대 10개까지만 유지
            const finalNarrative = combinedNarrative.slice(-10);
            
            await updateSelfNarrative(finalNarrative);
          }
          
          setLastExtractCount(currentMessageCount);
        } catch (error) {
          console.error('자아 정보 추출 실패:', error);
        }
      };
      
      extractSelfInfo();
    }
  }, [messages, globalSettings, user, persona, lastExtractCount, selfNarrative]);

  // 페르소나 설정 업데이트 함수들
  const updateTags = async (tags: string[]) => {
    setPersonaTags(tags);
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { tags });
      } catch (error) {
        console.error('태그 업데이트 실패:', error);
      }
    }
  };

  const updateExpressionPrefs = async (prefs: string[]) => {
    setExpressionPrefs(prefs);
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { expressionPrefs: prefs });
      } catch (error) {
        console.error('감정표현 업데이트 실패:', error);
      }
    }
  };

  const updateTmtRatio = async (ratio: number) => {
    setTmtRatio(ratio);
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { tmtRatio: ratio });
      } catch (error) {
        console.error('TMT 비율 업데이트 실패:', error);
      }
    }
  };

  const updateCharacterProfile = async (profile: Partial<typeof characterProfile>) => {
    const newProfile = { ...characterProfile, ...profile };
    setCharacterProfile(newProfile);
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { characterProfile: newProfile });
      } catch (error) {
        console.error('캐릭터 프로필 업데이트 실패:', error);
      }
    }
  };

  const updateAiName = async (name: string) => {
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { name });
        // AI 이름 업데이트 후 페르소나 객체도 업데이트
        setAiProfile({ name });
        return name; // 성공 시 이름 반환
      } catch (error) {
        console.error('AI 이름 업데이트 실패:', error);
        throw error;
      }
    }
    return name; // 기본값 반환
  };

  const updateSelfNarrative = async (narrative: string[]) => {
    setSelfNarrative(narrative);
    if (user && persona) {
      try {
        const personaRef = doc(db, 'personas', user.uid, 'items', persona.id);
        await updateDoc(personaRef, { selfNarrative: narrative });
      } catch (error) {
        console.error('자아 정보 업데이트 실패:', error);
      }
    }
  };

  const autoGenerateCharacter = async () => {
    setCharacterGenLoading(true);
    setCharacterGenError('');
    
    try {
      const characterInfo = await generateCharacterInfo(personaTags, expressionPrefs);
      await updateCharacterProfile(characterInfo);
    } catch (error) {
      setCharacterGenError('캐릭터 자동생성 중 오류가 발생했습니다.');
      console.error('캐릭터 생성 오류:', error);
    }
    
    setCharacterGenLoading(false);
  };

  // 어드민 권한 확인
  const { role: adminRole, loading: adminRoleLoading } = useAdminRole(user);

  // 사용자 프로필 및 페르소나 정보 로드
  useEffect(() => {
    if (!user) return;
    
    const fetchUserProfile = async () => {
      try {
        // 사용자 프로필 로드
        const profile = await profileService.getProfile(user.uid);
        setUserProfile({
          nickname: profile?.nickname || '사용자',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // 페르소나 정보 설정
        if (persona) {
          setAiProfile({ name: persona.name });
        } else {
          setAiProfile({ name: profile?.name || '세로' });
        }
      } catch (error) {
        console.error('프로필 로드 실패:', error);
        setUserProfile({
          nickname: '사용자',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        setAiProfile({ name: '세로' });
      }
    };
    
    fetchUserProfile();
  }, [user, persona]);

  // 채팅창 스크롤 최하단 이동 함수
  const scrollToBottom = () => {
    if (chatListRef.current) {
      // 직접 스크롤 위치를 설정하여 더 정확한 제어
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  };
  
  // 메시지가 추가될 때마다 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      // DOM 업데이트 후 즉시 스크롤
      setTimeout(scrollToBottom, 50);
    }
  }, [messages]);

  // 페르소나 설정 진입/종료 시 스크롤 위치 기억 및 복원
  const handleProfileOpen = () => {
    setUserProfileOpen(false);
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
    setProfileOpen(false);
    setUserProfileOpen(true);
  };

  // 메시지 전송 처리
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    const userMessage: Message = {
      sender: 'user',
      text: messageText,
      createdAt: new Date()
    };
    
    // 사용자 메시지 저장
    await saveMessage(userMessage);
    
    try {
      // 페르소나 정보를 기반으로 시스템 프롬프트 생성
      const systemPrompt = generateSystemPrompt();
      
      // 디버그: 시스템 프롬프트 출력 (개발 모드에서만)
      debugSystemPrompt(persona, systemPrompt);
      
      // 사용자 메시지에 시간 정보 추가
      const messageTime = userMessage.createdAt;
      const timeString = `${messageTime.getFullYear()}년 ${messageTime.getMonth() + 1}월 ${messageTime.getDate()}일 ${messageTime.getHours()}시 ${messageTime.getMinutes()}분`;
      const userMessageWithTime = `[${timeString}] ${messageText}`;
      
      // 채팅 메시지 구성
      const chatMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }) as ChatCompletionMessageParam),
        { role: 'user', content: userMessageWithTime },
      ];
      
      // AI 응답 생성
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
      });
      
      const aiText = res.choices[0].message?.content || '';
      
      // AI 응답을 문장별로 분리하여 순차 출력
      await addAiMessagesWithDelay(aiText);
      
    } catch (error) {
      errorLog('AI 응답 생성 실패:', error);
      // 에러 메시지 추가
      const errorMessage: Message = {
        sender: 'ai',
        text: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.',
        createdAt: new Date()
      };
      await saveMessage(errorMessage);
    }
  };
  
  // 시스템 프롬프트 생성
  const generateSystemPrompt = (): string => {
    if (!persona) {
      return '당신은 친근하고 도움이 되는 AI 어시스턴트입니다.';
    }
    
    // TMT 비율에 따른 답변 길이 지시
    let tmtInstruction = '';
    const tmtRatio = persona.tmtRatio || 50;
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
    
    // 글로벌 지침 추가
    let globalGuideline = '';
    if (globalSettings?.guidelines?.seroGuideline) {
      globalGuideline = `\n[글로벌 지침]\n${globalSettings.guidelines.seroGuideline}`;
    }
    
    // 관계 정보 추가 (현재는 기본값, 추후 구현 예정)
    let relationsInfo = '';
    // TODO: 개인 관계 데이터 로드 및 추가
    // relationsInfo = `\n[관계 정보]\n사용자 관계: ${userRelations}\n페르소나 관계: ${personaRelations}`;
    
    // 자아 정보 추가
    let selfInfo = '';
    if (selfNarrative && selfNarrative.length > 0) {
      selfInfo = `\n[자아 정보]\n${selfNarrative.join('\n')}`;
    }
    
    // 캐릭터 정보 추가
    let characterInfo = '';
    if (persona.characterProfile) {
      const char = persona.characterProfile;
      if (char.gender || char.job || char.description) {
        characterInfo = `\n[캐릭터 정보]\n성별: ${char.gender || '미정'}\n직업: ${char.job || '미정'}\n설명: ${char.description || '없음'}`;
      }
    }
    
    // 글로벌 설정의 동적 타입 시스템에 따라 성격 및 표현 정보 생성
    let personalityInfo = '';
    if (globalSettings?.personality?.types) {
      const typeInfo = globalSettings.personality.types.map(type => {
        if (type.type === 'tag') {
          // 태그형: 선택된 태그들만 필터링
          const selectedTags = (type.items as string[]).filter(item => 
            persona.tags?.includes(item)
          );
          if (selectedTags.length > 0) {
            return `${type.categoryName}: ${selectedTags.join(', ')}`;
          }
        } else {
          // 예시형: 선택된 라벨들만 필터링하고 예시 포함
          const selectedItems = (type.items as any[]).filter(item => 
            persona.expressionPrefs?.includes(item.label)
          );
          if (selectedItems.length > 0) {
            const itemsWithExamples = selectedItems.map(item => 
              `${item.label} (예시: ${item.example})`
            );
            return `${type.categoryName}: ${itemsWithExamples.join(', ')}`;
          }
        }
        return null;
      }).filter(Boolean);
      
      if (typeInfo.length > 0) {
        personalityInfo = typeInfo.join('\n');
      }
    }
    
    return `너는 감정형 페르소나 AI야.${globalGuideline}

[기본 정보]
- 네 이름: "${persona.name}"
- 사용자 닉네임: "${userProfile?.nickname || '사용자'}"

[성격 및 표현]
${personalityInfo || '- 설정된 성격 정보 없음'}
- 답변 길이: ${tmtInstruction}${characterInfo}${relationsInfo}${selfInfo}

지침을 지키고 일관성 있게 기본정보와 성격 및 표현 그리고 캐릭터 정보가 너라면 어떻게 대답할지 생각해서 대답해.`;
  };
  
  // AI 메시지 여러 문장 순차 출력
  const addAiMessagesWithDelay = async (text: string) => {
    setAiTyping(true); // 타이핑 시작
    
    const sentences = text.split(/(?<=[.!?])[\s\n]+/).map(s => s.trim()).filter(Boolean);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      // 지연 시간을 줄여서 더 빠르게 출력
      await new Promise(res => setTimeout(res, Math.max(sentence.length * 50, 200)));
      
      const aiMessage: Message = { 
        sender: 'ai', 
        text: sentence, 
        createdAt: new Date() 
      };
      
      await saveMessage(aiMessage);
      
      // 각 문장이 추가된 후 즉시 스크롤
      setTimeout(scrollToBottom, 10);
    }
    
    setAiTyping(false); // 타이핑 종료
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <>
      <div className="messenger-content" style={{ position: 'relative' }}>
        {/* 사용자 프로필 모달 */}
        {userProfileOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 300 }}>
            <div className="profile-page-overlay">
              <div className="profile-page-content">
                <button className="profile-page-close" onClick={() => setUserProfileOpen(false)} aria-label="닫기">←</button>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e3eaf5', marginBottom: 18, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="#b3e5fc"/><path d="M24 26c-5.33 0-10 2.17-10 6.5V36h20v-3.5c0-4.33-4.67-6.5-10-6.5Z" fill="#90caf9"/><circle cx="24" cy="18" r="6" fill="#90caf9"/></svg>
                </div>
                <div style={{ fontWeight: 700, color: '#1976d2', fontSize: 20, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {userProfile?.nickname || '사용자'}
                </div>
                <div style={{ color: '#888', fontSize: 15, marginBottom: 16 }}>프로필 정보 (추후 확장)</div>
                
                {/* 어드민만 글로벌 설정 버튼 노출 */}
                {adminRole === 1 && !adminRoleLoading && (
                  <button 
                    onClick={() => { 
                      setUserProfileOpen(false); 
                      navigate('/admin/global-settings', { 
                        state: { 
                          user: {
                            uid: user.uid,
                            email: user.email
                          }
                        } 
                      }); 
                    }}
                    style={{ 
                      background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)', 
                      color: '#fff', 
                      fontWeight: 700, 
                      border: 'none', 
                      borderRadius: 14, 
                      padding: '10px 18px', 
                      fontSize: 16, 
                      cursor: 'pointer', 
                      marginBottom: 12,
                      width: '100%'
                    }}
                  >
                    글로벌 설정
                  </button>
                )}
                
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
          
          {/* 페르소나 선택 버튼 */}
          <button 
            onClick={() => navigate('/personas')} 
            style={{ 
              background: 'linear-gradient(90deg, #90caf9 0%, #1976d2 100%)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 12, 
              padding: '8px 16px', 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: 'pointer', 
              marginRight: 8,
              transition: 'all 0.2s'
            }}
            title="페르소나 선택"
          >
            페르소나
          </button>
          
          {/* 우측상단 사용자 프로필 아이콘 */}
          <button onClick={handleUserProfileOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, padding: 0 }} aria-label="내 프로필 열기">
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e3eaf5', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="#b3e5fc"/><path d="M24 26c-5.33 0-10 2.17-10 6.5V36h20v-3.5c0-4.33-4.67-6.5-10-6.5Z" fill="#90caf9"/><circle cx="24" cy="18" r="6" fill="#90caf9"/></svg>
            </div>
          </button>
        </div>

        {/* 채팅 리스트 */}
        <div
          className="chat-list chat-list-bordered"
          ref={chatListRef}
          onScroll={loadMoreMessages}
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
          onSendMessage={handleSendMessage}
          isTyping={aiTyping}
          disabled={loading}
        />
      </div>

      {/* 프로필 모달 */}
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
        onUpdateTags={updateTags}
        onUpdateExpressionPrefs={updateExpressionPrefs}
        onUpdateTmtRatio={updateTmtRatio}
        onAutoGenerateCharacter={autoGenerateCharacter}
        onUpdateCharacterProfile={updateCharacterProfile}
        onUpdateAiName={updateAiName}
        selfNarrative={selfNarrative} // 자아 정보 전달
        onUpdateSelfNarrative={updateSelfNarrative} // 자아 정보 업데이트 함수 전달
      />
    </>
  );
};

export default ChatInterface; 