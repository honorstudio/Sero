import React, { useState } from 'react';
import { AiProfile, CharacterProfile } from '../../types';
import { allTags, expressionPresets } from '../../utils/personaUtils';
import './ProfileModal.module.css';

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
      <div className="profile-page-overlay">
        <div className="profile-page-content">
          <button className="profile-page-close" onClick={onClose} aria-label="닫기">←</button>
          
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
            <div className="ai-name-popup-overlay">
              <div className="ai-name-popup-content">
                <input
                  type="text"
                  value={aiNameInput}
                  onChange={e => setAiNameInput(e.target.value)}
                  maxLength={12}
                  className="ai-name-input"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAiName(); }}
                  aria-label="AI 이름 입력"
                  placeholder="새로운 AI 이름"
                />
                {aiNameError && <div className="ai-name-error">{aiNameError}</div>}
                <button
                  onClick={handleSaveAiName}
                  disabled={aiNameSaving}
                  className="ai-name-save-btn"
                >
                  {aiNameSaving ? '저장 중...' : '이름 선물하기'}
                </button>
                <button
                  onClick={() => setAiNameEditOpen(false)}
                  className="ai-name-cancel-btn"
                >
                  취소
                </button>
                <div className="ai-name-description">
                  세로에게 새 이름은 <span className="highlight">선물</span>과 같아요.<br/>신중하게 지어주세요.
                </div>
              </div>
            </div>
          )}

          {/* 태그(성격/감정표현) UI */}
          {tagEditMode ? (
            <>
              {/* 분위기 태그 */}
              <div className="profile-section">
                <div className="profile-section-title">
                  분위기 <span className="section-subtitle">(최대 2개)</span>
                </div>
                <div className="persona-tags-list">
                  {allTags.filter(t => t.category === '대형').map(tag => (
                    <span
                      key={tag.name}
                      className={`persona-tag ${personaTags.includes(tag.name) ? 'active' : 'inactive'}`}
                      onClick={() => {
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
                        onUpdateTags(nextTags);
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* 성격 태그 */}
              <div className="profile-section">
                <div className="profile-section-title">
                  성격 <span className="section-subtitle">(최대 4개)</span>
                </div>
                <div className="persona-tags-list">
                  {allTags.filter(t => t.category === '유형').map(tag => (
                    <span
                      key={tag.name}
                      className={`persona-tag ${personaTags.includes(tag.name) ? 'active' : 'inactive'}`}
                      onClick={() => {
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
                        onUpdateTags(nextTags);
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* 감정표현 태그 */}
              <div className="profile-section">
                <div className="profile-section-title">
                  감정표현 <span className="section-subtitle">(최대 4개)</span>
                </div>
                <div className="persona-tags-list">
                  {expressionPresets.map(preset => (
                    <span
                      key={preset.key}
                      className={`persona-tag expr-preset ${expressionPrefs.includes(preset.key) ? 'active' : 'inactive'}`}
                      onClick={() => {
                        let next = [...expressionPrefs];
                        const isActive = next.includes(preset.key);
                        if (isActive) {
                          if (next.length <= 1) return; // 최소 1개
                          next = next.filter(k => k !== preset.key);
                        } else {
                          if (next.length >= 4) return; // 최대 4개
                          next.push(preset.key);
                        }
                        onUpdateExpressionPrefs(next);
                      }}
                    >
                      {preset.label} <span className="preset-example">{preset.example}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* TMT 비율 슬라이더 */}
              <div className="profile-section">
                <div className="profile-section-title">
                  답변 길이 <span className="section-subtitle">(TMT 비율)</span>
                </div>
                <div className="tmt-slider-container">
                  <div className="tmt-slider-labels">
                    <span>간결</span>
                    <span className="tmt-value">{tmtRatio}%</span>
                    <span>자세</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tmtRatio}
                    onChange={(e) => onUpdateTmtRatio(Number(e.target.value))}
                    className="tmt-slider"
                  />
                  <div className="tmt-slider-markers">
                    <span>단답</span>
                    <span>적당</span>
                    <span>TMT</span>
                  </div>
                </div>
              </div>

              {/* 캐릭터 프로필 입력란 */}
              <div className="profile-section">
                <div className="profile-section-title">
                  정보<span className="section-subtitle">(직접 수정 가능)</span>
                </div>
                <div className="character-inputs">
                  <button 
                    type="button" 
                    onClick={onAutoGenerateCharacter} 
                    disabled={characterGenLoading}
                    className="auto-generate-btn"
                  >
                    {characterGenLoading ? '생성 중...' : '자동생성'}
                  </button>
                  {characterGenError && <div className="character-error">{characterGenError}</div>}
                  <input
                    type="text"
                    placeholder="성별 (예: 남성, 여성, 미정)"
                    value={characterProfile.gender}
                    onChange={e => onUpdateCharacterProfile({ gender: e.target.value })}
                    className="character-input"
                  />
                  <input
                    type="text"
                    placeholder="직업 (예: 대학생, 디자이너, 미정)"
                    value={characterProfile.job}
                    onChange={e => onUpdateCharacterProfile({ job: e.target.value })}
                    className="character-input"
                  />
                  <textarea
                    placeholder="간단한 설명 (예: 밝고 외향적인 성격의 대학생)"
                    value={characterProfile.description}
                    onChange={e => onUpdateCharacterProfile({ description: e.target.value })}
                    className="character-textarea"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 읽기 전용 모드 */}
              <div className="profile-section">
                <div className="profile-section-title">분위기</div>
                <div className="persona-tags-list">
                  {allTags.filter(t => t.category === '대형' && personaTags.includes(t.name)).map(tag => (
                    <span key={tag.name} className="persona-tag active" style={{ pointerEvents: 'none' }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="profile-section">
                <div className="profile-section-title">성격</div>
                <div className="persona-tags-list">
                  {allTags.filter(t => t.category === '유형' && personaTags.includes(t.name)).map(tag => (
                    <span key={tag.name} className="persona-tag active" style={{ pointerEvents: 'none' }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="profile-section">
                <div className="profile-section-title">감정표현</div>
                <div className="persona-tags-list">
                  {expressionPresets.filter(preset => expressionPrefs.includes(preset.key)).map(preset => (
                    <span key={preset.key} className="persona-tag expr-preset active" style={{ pointerEvents: 'none' }}>
                      {preset.label} <span className="preset-example">{preset.example}</span>
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="profile-section">
                <div className="profile-section-title">답변 길이</div>
                <div className="tmt-slider-container">
                  <div className="tmt-slider-labels">
                    <span>간결</span>
                    <span className="tmt-value">{tmtRatio}%</span>
                    <span>자세</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tmtRatio}
                    disabled={true}
                    className="tmt-slider disabled"
                  />
                  <div className="tmt-slider-markers">
                    <span>한 문장</span>
                    <span>적당</span>
                    <span>매우 자세</span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <div className="profile-section-title">가상 캐릭터 정보</div>
                <div className="character-info">
                  <div>성별: {characterProfile.gender || '미정'}</div>
                  <div>직업: {characterProfile.job || '미정'}</div>
                  <div>설명: {characterProfile.description || '없음'}</div>
                </div>
              </div>
            </>
          )}

          {/* 버튼 */}
          {tagEditMode ? (
            <button className="profile-reset-btn" onClick={handleProfileResetComplete}>
              재설정 완료
            </button>
          ) : (
            <button className="profile-reset-btn" onClick={() => setTagEditMode(true)}>
              성격 재설정
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal; 