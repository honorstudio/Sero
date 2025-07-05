import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PersonaListItem, CreatePersonaRequest } from '../types';
import { personaService } from '../services/firebaseService';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import styles from './PersonaSelectionPage.module.css';

interface PersonaSelectionPageProps {
  user: any;
}

const PersonaSelectionPage: React.FC<PersonaSelectionPageProps> = ({ user }) => {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { settings: globalSettings, loading: globalSettingsLoading } = useGlobalSettings();

  // 페르소나 목록 로드
  useEffect(() => {
    if (!user || !globalSettings) {
      console.log('페르소나 로드 조건 미충족:', { user: !!user, globalSettings: !!globalSettings });
      return;
    }
    
    console.log('페르소나 목록 로드 시작...', { userId: user.uid });
    
    const loadPersonas = async () => {
      try {
        setLoading(true);
        setError(null);
        const personaList = await personaService.getPersonas(user.uid);
        console.log('페르소나 목록 로드 완료:', personaList);
        setPersonas(personaList);
        
        // 페르소나가 없으면 글로벌 설정의 기본값으로 "세로" 생성
        if (personaList.length === 0) {
          console.log('페르소나가 없어서 기본 "세로" 페르소나 생성 시작...');
          try {
            // 글로벌 설정에서 기본값 가져오기
            const defaultTags: string[] = [];
            const defaultExpressions: string[] = [];
            
            Object.entries(globalSettings?.personality.defaultTypeSettings || {}).forEach(([categoryName, selectedItems]) => {
              const type = globalSettings?.personality.types.find((t: any) => t.categoryName === categoryName);
              if (type) {
                if (type.type === 'tag') {
                  defaultTags.push(...(selectedItems as string[]));
                } else if (type.type === 'example') {
                  defaultExpressions.push(...(selectedItems as string[]));
                }
              }
            });

            const defaultPersonaData: CreatePersonaRequest = {
              name: '세로',
              tags: defaultTags.length > 0 ? defaultTags : ['유쾌함', '진지함'],
              expressionPrefs: defaultExpressions,
              tmtRatio: globalSettings?.system.tmtRatio || 50,
              characterProfile: {
                gender: '',
                job: '',
                description: ''
              }
            };

            console.log('기본 "세로" 페르소나 데이터:', defaultPersonaData);
            const personaId = await personaService.createPersona(user.uid, defaultPersonaData);
            console.log('기본 "세로" 페르소나 생성 완료:', personaId);
            
            const updatedList = await personaService.getPersonas(user.uid);
            setPersonas(updatedList);
          } catch (createError) {
            console.error('기본 "세로" 페르소나 생성 실패:', createError);
            setError('기본 페르소나 생성에 실패했습니다. 다시 시도해주세요.');
          }
        }
      } catch (err) {
        console.error('페르소나 목록 로드 실패:', err);
        setError('페르소나 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadPersonas();
  }, [user, globalSettings]);

  // 페르소나 생성 후, 데이터가 완전히 반영될 때까지 재시도
  const waitForPersonaReady = async (userId: string, personaId: string, maxTries = 10, delay = 200) => {
    for (let i = 0; i < maxTries; i++) {
      const persona = await personaService.getPersona(userId, personaId);
      // 주요 필드가 비어있지 않으면 성공
      if (persona && persona.tags.length > 0 && persona.characterProfile && persona.characterProfile.gender) {
        return persona;
      }
      await new Promise(res => setTimeout(res, delay));
    }
    // 그래도 안되면 마지막 값 반환
    return await personaService.getPersona(userId, personaId);
  };

  // 페르소나 생성
  const handleCreatePersona = async () => {
    if (!newPersonaName.trim()) return;
    
    try {
      setCreating(true);
      
      // 글로벌 설정에서 기본값 가져오기
      const defaultTags: string[] = [];
      const defaultExpressions: string[] = [];
      
      Object.entries(globalSettings?.personality.defaultTypeSettings || {}).forEach(([categoryName, selectedItems]) => {
        const type = globalSettings?.personality.types.find((t: any) => t.categoryName === categoryName);
        if (type) {
          if (type.type === 'tag') {
            defaultTags.push(...(selectedItems as string[]));
          } else if (type.type === 'example') {
            defaultExpressions.push(...(selectedItems as string[]));
          }
        }
      });

      const newPersonaData: CreatePersonaRequest = {
        name: newPersonaName.trim(),
        tags: defaultTags,
        expressionPrefs: defaultExpressions,
        tmtRatio: globalSettings?.system.tmtRatio || 50,
        characterProfile: {
          gender: '',
          job: '',
          description: ''
        }
      };

      const newPersonaId = await personaService.createPersona(user.uid, newPersonaData);
      // 폴링으로 데이터가 채워질 때까지 대기
      await waitForPersonaReady(user.uid, newPersonaId);
      
      // 목록 새로고침
      const updatedList = await personaService.getPersonas(user.uid);
      setPersonas(updatedList);
      
      setNewPersonaName('');
      setShowCreateModal(false);
      
      // 새로 생성된 페르소나와 바로 채팅 시작
      navigate(`/chat/${newPersonaId}`);
    } catch (err) {
      console.error('페르소나 생성 실패:', err);
      alert('페르소나 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 페르소나 삭제
  const handleDeletePersona = async (personaId: string) => {
    try {
      await personaService.deletePersona(user.uid, personaId);
      
      // 목록 새로고침
      const updatedList = await personaService.getPersonas(user.uid);
      setPersonas(updatedList);
      
      setDeleteConfirm(null);
    } catch (err) {
      console.error('페르소나 삭제 실패:', err);
      alert('페르소나 삭제에 실패했습니다.');
    }
  };

  // 페르소나 선택
  const handleSelectPersona = (personaId: string) => {
    navigate(`/chat/${personaId}`);
  };

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>페르소나 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>페르소나 선택</h1>
        <p className={styles.subtitle}>
          대화할 페르소나를 선택하거나 새로운 페르소나를 만들어보세요
        </p>
      </div>

      <div className={styles.personaGrid}>
        {personas.map((persona) => (
          <div key={persona.id} className={styles.personaCard}>
            <div className={styles.personaHeader}>
              <h3 className={styles.personaName}>{persona.name}</h3>
              <div className={styles.personaActions}>
                <button
                  onClick={() => setDeleteConfirm(persona.id)}
                  className={styles.deleteButton}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className={styles.personaInfo}>
              <div className={styles.personaStats}>
                <span className={styles.statItem}>
                  💬 {persona.messageCount || 0}개 메시지
                </span>
                {persona.lastMessageAt && (
                  <span className={styles.statItem}>
                    📅 {formatDate(persona.lastMessageAt)}
                  </span>
                )}
              </div>
              
              <div className={styles.personaTags}>
                {persona.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                  </span>
                ))}
                {persona.tags.length > 3 && (
                  <span className={styles.moreTags}>+{persona.tags.length - 3}</span>
                )}
              </div>
            </div>
            
            <button
              onClick={() => handleSelectPersona(persona.id)}
              className={styles.selectButton}
            >
              대화 시작
            </button>
          </div>
        ))}
        
        <div className={styles.createCard} onClick={() => setShowCreateModal(true)}>
          <div className={styles.createIcon}>+</div>
          <h3 className={styles.createTitle}>새 페르소나 만들기</h3>
          <p className={styles.createSubtitle}>
            새로운 성격의 AI 친구를 만들어보세요
          </p>
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>새 페르소나 만들기</h3>
            <div className={styles.modalContent}>
              <label className={styles.modalLabel}>페르소나 이름</label>
              <input
                type="text"
                value={newPersonaName}
                onChange={(e) => setNewPersonaName(e.target.value)}
                placeholder="예: 친구, 연인, 선배..."
                className={styles.modalInput}
                maxLength={20}
              />
              <p className={styles.modalHint}>
                기본 설정으로 생성되며, 나중에 프로필에서 세부 설정을 변경할 수 있습니다.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowCreateModal(false)}
                className={styles.modalCancelButton}
                disabled={creating}
              >
                취소
              </button>
              <button
                onClick={handleCreatePersona}
                className={styles.modalConfirmButton}
                disabled={creating || !newPersonaName.trim()}
              >
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>페르소나 삭제</h3>
            <div className={styles.modalContent}>
              <p className={styles.deleteWarning}>
                이 페르소나와의 모든 대화 기록이 영구적으로 삭제됩니다.
                <br />
                정말 삭제하시겠습니까?
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className={styles.modalCancelButton}
              >
                취소
              </button>
              <button
                onClick={() => handleDeletePersona(deleteConfirm)}
                className={styles.modalDeleteButton}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaSelectionPage; 