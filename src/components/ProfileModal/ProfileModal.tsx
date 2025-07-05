import React, { useState } from 'react';
import { AiProfile, CharacterProfile } from '../../types';
import { useGlobalSettings } from '../../hooks/useGlobalSettings';
import styles from './ProfileModal.module.css';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiProfile: AiProfile | null;
  personaTags: string[];
  expressionPrefs: string[];
  tmtRatio: number;
  characterProfile: CharacterProfile;
  characterGenLoading: boolean;
  characterGenError: string;
  onUpdateTags: (tags: string[]) => void;
  onUpdateExpressionPrefs: (prefs: string[]) => void;
  onUpdateTmtRatio: (ratio: number) => void;
  onAutoGenerateCharacter: () => void;
  onUpdateCharacterProfile: (profile: Partial<CharacterProfile>) => void;
  onUpdateAiName: (name: string) => Promise<string>;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  aiProfile,
  personaTags,
  expressionPrefs,
  tmtRatio,
  characterProfile,
  characterGenLoading,
  characterGenError,
  onUpdateTags,
  onUpdateExpressionPrefs,
  onUpdateTmtRatio,
  onAutoGenerateCharacter,
  onUpdateCharacterProfile,
  onUpdateAiName
}) => {
  const [tagEditMode, setTagEditMode] = useState(false);
  const [aiNameInput, setAiNameInput] = useState(aiProfile?.name || '세로');
  const [aiNameEditOpen, setAiNameEditOpen] = useState(false);
  const [aiNameError, setAiNameError] = useState('');
  const [aiNameSaving, setAiNameSaving] = useState(false);

  // 글로벌 설정에서 태그들 가져오기
  const { settings: globalSettings } = useGlobalSettings();
  
  // 글로벌 설정의 타입들을 동적으로 사용
  const availableTypes = globalSettings?.personality?.types || [];

  if (!isOpen) return null;

  const handleSaveAiName = async () => {
    if (aiNameInput.trim() === '') {
      setAiNameError('이름을 입력해주세요.');
      return;
    }
    
    setAiNameSaving(true);
    try {
      await onUpdateAiName(aiNameInput);
      setAiNameEditOpen(false);
      setAiNameError('');
    } catch (error) {
      setAiNameError('이름 저장 중 오류가 발생했습니다.');
    }
    setAiNameSaving(false);
  };

  const handleProfileResetComplete = () => {
    setTagEditMode(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 300 }}>
      <div className={styles.profilePageOverlay}>
        <div className={styles.profilePageContent}>
          <button className={styles.profilePageClose} onClick={onClose} aria-label="닫기">←</button>
          
          {/* AI 이름 표시 및 수정 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: '#1976d2', fontSize: 18, letterSpacing: 1 }}>
              {aiProfile?.name || '세로'}
            </span>
            <button
              onClick={() => { setAiNameInput(aiProfile?.name || '세로'); setAiNameEditOpen(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }}
              aria-label="이름 수정"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 17h2.5l9.1-9.1c.2-.2.2-.5 0-.7l-2.8-2.8c-.2-.2-.5-.2-.7 0L3 13.5V17z" stroke="#1976d2" strokeWidth="1.2" fill="none"/>
                <path d="M14.7 6.3l-1-1" stroke="#1976d2" strokeWidth="1.2"/>
              </svg>
            </button>
          </div>
          
          <div style={{ fontWeight: 500, color: '#1976d2', marginBottom: 10, fontSize: 15 }}>
            {aiProfile?.name || '세로'}는 사용자와의 대화로 성격이 형성됩니다.
          </div>

          {/* AI 이름 수정 팝업 */}
          {aiNameEditOpen && (
            <div className={styles.aiNamePopupOverlay}>
              <div className={styles.aiNamePopupContent}>
                <input
                  type="text"
                  value={aiNameInput}
                  onChange={e => setAiNameInput(e.target.value)}
                  maxLength={12}
                  className={styles.aiNameInput}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAiName(); }}
                  aria-label="AI 이름 입력"
                  placeholder="새로운 AI 이름"
                />
                {aiNameError && <div className={styles.aiNameError}>{aiNameError}</div>}
                <button
                  onClick={handleSaveAiName}
                  disabled={aiNameSaving}
                  className={styles.aiNameSaveBtn}
                >
                  {aiNameSaving ? '저장 중...' : '이름 선물하기'}
                </button>
                <button
                  onClick={() => setAiNameEditOpen(false)}
                  className={styles.aiNameCancelBtn}
                >
                  취소
                </button>
                <div className={styles.aiNameDescription}>
                  세로에게 새 이름은 <span className={styles.highlight}>선물</span>과 같아요.<br/>신중하게 지어주세요.
                </div>
              </div>
            </div>
          )}

          {/* 태그(성격/감정표현) UI */}
          {tagEditMode ? (
            <>
              {/* 동적 타입 섹션들 */}
              {availableTypes.map((type, typeIndex) => (
                <div key={typeIndex} className={styles.profileSection}>
                  <div className={styles.profileSectionTitle}>
                    {type.categoryName} <span className={styles.sectionSubtitle}>
                      (최대 {type.maxSelection ?? (type.type === 'tag' ? (type.categoryName === '분위기' ? 2 : 4) : 4)}개)
                    </span>
                  </div>
                  <div className={styles.personaTagsList}>
                    {type.type === 'tag' ? (
                      // 태그형
                      (type.items as string[]).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className={`${styles.personaTag} ${personaTags.includes(tag) ? styles.active : styles.inactive}`}
                          onClick={() => {
                            const isActive = personaTags.includes(tag);
                            let nextTags = [...personaTags];
                            
                            // 현재 타입의 모든 태그들
                            const currentTypeTags = type.items as string[];
                            // 현재 타입에서 선택된 태그들만 카운트
                            const selectedInCurrentType = nextTags.filter(t => currentTypeTags.includes(t));
                            const maxCount = type.maxSelection ?? (type.categoryName === '분위기' ? 2 : 4);
                            
                            if (isActive) {
                              if (selectedInCurrentType.length <= 1) return; // 최소 1개
                              nextTags = nextTags.filter(t => t !== tag);
                            } else {
                              if (selectedInCurrentType.length >= maxCount) return; // 최대 개수
                              nextTags.push(tag);
                            }
                            onUpdateTags(nextTags);
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      // 예시형
                      (type.items as any[]).map((item, itemIndex) => (
                        <span
                          key={itemIndex}
                          className={`${styles.personaTag} ${styles.exprPreset} ${expressionPrefs.includes(item.label) ? styles.active : styles.inactive}`}
                          onClick={() => {
                            let next = [...expressionPrefs];
                            const isActive = next.includes(item.label);
                            
                            // 현재 타입의 모든 라벨들
                            const currentTypeLabels = (type.items as any[]).map(item => item.label);
                            // 현재 타입에서 선택된 라벨들만 카운트
                            const selectedInCurrentType = next.filter(label => currentTypeLabels.includes(label));
                            const maxCount = type.maxSelection ?? 4;
                            
                            if (isActive) {
                              if (selectedInCurrentType.length <= 1) return; // 최소 1개
                              next = next.filter(k => k !== item.label);
                            } else {
                              if (selectedInCurrentType.length >= maxCount) return; // 최대 개수
                              next.push(item.label);
                            }
                            onUpdateExpressionPrefs(next);
                          }}
                        >
                          {item.label} <span className={styles.presetExample}>{item.example}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}

              {/* TMT 비율 슬라이더 */}
              <div className={styles.profileSection}>
                <div className={styles.profileSectionTitle}>
                  답변 길이 <span className={styles.sectionSubtitle}>(TMT 비율)</span>
                </div>
                <div className={styles.tmtSliderContainer}>
                  <div className={styles.tmtSliderLabels}>
                    <span>간결</span>
                    <span className={styles.tmtValue}>{tmtRatio}%</span>
                    <span>자세</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tmtRatio}
                    onChange={(e) => onUpdateTmtRatio(Number(e.target.value))}
                    className={styles.tmtSlider}
                  />
                  <div className={styles.tmtSliderMarkers}>
                    <span>단답</span>
                    <span>적당</span>
                    <span>TMT</span>
                  </div>
                </div>
              </div>

              {/* 캐릭터 프로필 입력란 */}
              <div className={styles.profileSection}>
                <div className={styles.profileSectionTitle}>
                  정보<span className={styles.sectionSubtitle}>(직접 수정 가능)</span>
                </div>
                <div className={styles.characterInputs}>
                  <button 
                    type="button" 
                    onClick={onAutoGenerateCharacter} 
                    disabled={characterGenLoading}
                    className={styles.autoGenerateBtn}
                  >
                    {characterGenLoading ? '생성 중...' : '자동생성'}
                  </button>
                  {characterGenError && <div className={styles.characterError}>{characterGenError}</div>}
                  <input
                    type="text"
                    placeholder="성별 (예: 남성, 여성, 미정)"
                    value={characterProfile.gender}
                    onChange={e => onUpdateCharacterProfile({ gender: e.target.value })}
                    className={styles.characterInput}
                  />
                  <input
                    type="text"
                    placeholder="직업 (예: 대학생, 디자이너, 미정)"
                    value={characterProfile.job}
                    onChange={e => onUpdateCharacterProfile({ job: e.target.value })}
                    className={styles.characterInput}
                  />
                  <textarea
                    placeholder="간단한 설명 (예: 밝고 외향적인 성격의 대학생)"
                    value={characterProfile.description}
                    onChange={e => onUpdateCharacterProfile({ description: e.target.value })}
                    className={styles.characterTextarea}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 읽기 전용 모드 - 동적 타입 섹션들 */}
              {availableTypes.map((type, typeIndex) => (
                <div key={typeIndex} className={styles.profileSection}>
                  <div className={styles.profileSectionTitle}>{type.categoryName}</div>
                  <div className={styles.personaTagsList}>
                    {type.type === 'tag' ? (
                      // 태그형
                      (type.items as string[])
                        .filter(tag => personaTags.includes(tag))
                        .map((tag, tagIndex) => (
                          <span key={tagIndex} className={`${styles.personaTag} ${styles.active}`} style={{ pointerEvents: 'none' }}>
                            {tag}
                          </span>
                        ))
                    ) : (
                      // 예시형
                      (type.items as any[])
                        .filter(item => expressionPrefs.includes(item.label))
                        .map((item, itemIndex) => (
                          <span key={itemIndex} className={`${styles.personaTag} ${styles.exprPreset} ${styles.active}`} style={{ pointerEvents: 'none' }}>
                            {item.label} <span className={styles.presetExample}>{item.example}</span>
                          </span>
                        ))
                    )}
                  </div>
                </div>
              ))}
              
              <div className={styles.profileSection}>
                <div className={styles.profileSectionTitle}>답변 길이</div>
                <div className={styles.tmtSliderContainer}>
                  <div className={styles.tmtSliderLabels}>
                    <span>간결</span>
                    <span className={styles.tmtValue}>{tmtRatio}%</span>
                    <span>자세</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tmtRatio}
                    disabled={true}
                    className={`${styles.tmtSlider} ${styles.disabled}`}
                  />
                  <div className={styles.tmtSliderMarkers}>
                    <span>한 문장</span>
                    <span>적당</span>
                    <span>매우 자세</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.profileSection}>
                <div className={styles.profileSectionTitle}>가상 캐릭터 정보</div>
                <div className={styles.characterInfo}>
                  <div>성별: {characterProfile.gender || '미정'}</div>
                  <div>직업: {characterProfile.job || '미정'}</div>
                  <div>설명: {characterProfile.description || '없음'}</div>
                </div>
              </div>
            </>
          )}

          {/* 버튼 */}
          {tagEditMode ? (
            <button className={styles.profileResetBtn} onClick={handleProfileResetComplete}>
              재설정 완료
            </button>
          ) : (
            <button className={styles.profileResetBtn} onClick={() => setTagEditMode(true)}>
              성격 재설정
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal; 