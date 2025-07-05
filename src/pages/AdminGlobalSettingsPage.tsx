import React, { useState, useEffect } from 'react';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { GlobalSettings, PersonalityType, ExpressionItem, TypeBackup } from '../types';
import { GlobalSettingsService } from '../services/globalSettingsService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminRole } from '../hooks/useAdminRole';
import styles from './AdminGlobalSettingsPage.module.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AdminGlobalSettingsPageProps {
  user: any;
}



// 드래그 가능한 타입 아이템 컴포넌트
const SortableTypeItem: React.FC<{
  type: PersonalityType;
  typeIndex: number;
  onDeleteType: (index: number) => void;
  onAddTagItem: (typeIndex: number, tagInput: string) => void;
  onAddExampleItem: (typeIndex: number, label: string, example: string) => void;
  onDeleteItem: (typeIndex: number, itemIndex: number) => void;
  onUpdateMaxSelection: (typeIndex: number, maxSelection: number) => void;
}> = ({ type, typeIndex, onDeleteType, onAddTagItem, onAddExampleItem, onDeleteItem, onUpdateMaxSelection }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `type-${typeIndex}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={styles.adminTypeCard}>
        <div className={styles.adminTypeHeader}>
          <div className={styles.adminTypeTitle}>
            <div 
              {...attributes} 
              {...listeners}
              className={styles.adminDragHandle}
            >
              ⋮⋮
            </div>
            {type.categoryName} ({type.type === 'tag' ? '태그형' : '예시형'})
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteType(typeIndex);
            }}
            className={styles.adminButtonDanger}
          >
            타입 삭제
          </button>
        </div>
        
        {/* 최대 선택 개수 설정 */}
        <div style={{ marginBottom: '16px' }}>
          <label className={styles.adminLabel}>최대 선택 개수</label>
          <input
            type="number"
            min="1"
            value={type.maxSelection || 1}
            onChange={(e) => onUpdateMaxSelection(typeIndex, Number(e.target.value))}
            className={styles.adminInput}
            style={{ width: '120px' }}
            placeholder="최대 선택 개수"
          />
        </div>
        
        {/* 아이템 목록 */}
        <div style={{ marginBottom: '16px' }}>
          {type.type === 'tag' ? (
            <div>
              {(type.items as string[]).map((item, itemIndex) => (
                <span key={itemIndex} className={styles.adminTagItem}>
                  {item}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteItem(typeIndex, itemIndex);
                    }}
                    className={styles.adminDeleteButton}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div>
              {(type.items as ExpressionItem[]).map((item, itemIndex) => (
                <div key={itemIndex} className={styles.adminExampleItem}>
                  <div style={{ fontWeight: '600', color: '#1976d2', fontSize: '13px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{item.example}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteItem(typeIndex, itemIndex);
                    }}
                    className={styles.adminDeleteButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 아이템 추가 */}
        {type.type === 'tag' ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="태그 입력 (콤마로 구분)"
              className={styles.adminInput}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onAddTagItem(typeIndex, (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                onAddTagItem(typeIndex, input.value);
                input.value = '';
              }}
              className={styles.adminButton}
            >
              추가
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px' }}>
            <input
              type="text"
              placeholder="라벨"
              className={styles.adminInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const labelInput = e.target as HTMLInputElement;
                  const exampleInput = labelInput.parentElement?.nextElementSibling?.querySelector('input') as HTMLInputElement;
                  onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                  labelInput.value = '';
                  exampleInput.value = '';
                }
              }}
            />
            <input
              type="text"
              placeholder="예시"
              className={styles.adminInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const exampleInput = e.target as HTMLInputElement;
                  const labelInput = exampleInput.parentElement?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                  onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                  labelInput.value = '';
                  exampleInput.value = '';
                }
              }}
            />
            <button
              onClick={(e) => {
                const labelInput = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                const exampleInput = labelInput.nextElementSibling as HTMLInputElement;
                onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                labelInput.value = '';
                exampleInput.value = '';
              }}
              className={styles.adminButton}
            >
              추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminGlobalSettingsPage: React.FC<AdminGlobalSettingsPageProps> = ({ user: propUser }) => {
  const { settings, loading, error, refreshSettings } = useGlobalSettings();
  const [editSettings, setEditSettings] = useState<GlobalSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // props로 받은 user 또는 location state에서 user 가져오기
  const user = propUser || location.state?.user;
  const { role: adminRole, loading: adminRoleLoading } = useAdminRole(user);

  // 타입 추가 모달 상태
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    categoryName: '',
    type: 'tag' as 'tag' | 'example',
    tagInput: '',
    labelInput: '',
    exampleInput: ''
  });

  // 기본 타입 설정 토글 상태
  const [defaultTypeSettingsOpen, setDefaultTypeSettingsOpen] = useState(false);

  // 백업 관련 상태
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backups, setBackups] = useState<TypeBackup[]>([]);

  // 타입 삭제 관련 상태
  const [deleteTypeIndex, setDeleteTypeIndex] = useState<number | null>(null);
  const [showDeleteTypeModal, setShowDeleteTypeModal] = useState(false);

  // 드래그앤드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (settings) {
      // 기본값 설정으로 undefined 방지
      const settingsWithDefaults = {
        ...settings,
        personality: {
          ...settings.personality,
          types: settings.personality.types || [],
          defaultTypeSettings: settings.personality.defaultTypeSettings || {}
        }
      };
      setEditSettings(settingsWithDefaults);
    }
  }, [settings]);

  // 백업 목록 불러오기
  useEffect(() => {
    const loadBackups = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const backupRef = doc(db, 'global', 'type_backups');
        const backupSnap = await getDoc(backupRef);
        if (backupSnap.exists()) {
          setBackups(backupSnap.data().backups || []);
        }
      } catch (err) {
        console.error('백업 목록 로드 실패:', err);
      }
    };
    loadBackups();
  }, []);

  const handleChange = (section: string, key: string, value: any) => {
    if (!editSettings) return;
    setEditSettings(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (section in updated) {
        (updated as any)[section][key] = value;
      }
      return updated;
    });
  };

  // 기본 타입 설정 변경
  const handleDefaultTypeSettingChange = (categoryName: string, selectedItems: string[]) => {
    if (!editSettings) return;
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        defaultTypeSettings: {
          ...prev!.personality.defaultTypeSettings,
          [categoryName]: selectedItems
        }
      }
    }));
  };

  // 타입 추가 함수
  const handleAddType = () => {
    if (!editSettings || !newTypeData.categoryName.trim()) return;
    
    let newType: PersonalityType;
    
    if (newTypeData.type === 'tag') {
      const tags = newTypeData.tagInput.split(',').map(tag => tag.trim()).filter(Boolean);
      newType = {
        categoryName: newTypeData.categoryName.trim(),
        type: 'tag',
        items: tags
      };
    } else {
      if (!newTypeData.labelInput.trim() || !newTypeData.exampleInput.trim()) return;
      newType = {
        categoryName: newTypeData.categoryName.trim(),
        type: 'example',
        items: [{
          label: newTypeData.labelInput.trim(),
          example: newTypeData.exampleInput.trim()
        }]
      };
    }

    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: [...prev!.personality.types, newType]
      }
    }));

    // 모달 초기화
    setNewTypeData({
      categoryName: '',
      type: 'tag',
      tagInput: '',
      labelInput: '',
      exampleInput: ''
    });
    setShowAddTypeModal(false);
  };

  // 태그형 아이템 추가 함수
  const handleAddTagItem = (typeIndex: number, tagInput: string) => {
    if (!editSettings || !tagInput.trim()) return;
    const tags = tagInput.split(',').map(tag => tag.trim()).filter(Boolean);
    
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: prev!.personality.types.map((type, index) => 
          index === typeIndex && type.type === 'tag' 
            ? { ...type, items: [...(type.items as string[]), ...tags] }
            : type
        )
      }
    }));
  };

  // 예시형 아이템 추가 함수
  const handleAddExampleItem = (typeIndex: number, label: string, example: string) => {
    if (!editSettings || !label.trim() || !example.trim()) return;
    
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: prev!.personality.types.map((type, index) => 
          index === typeIndex && type.type === 'example'
            ? { 
                ...type, 
                items: [...(type.items as ExpressionItem[]), { label: label.trim(), example: example.trim() }] 
              }
            : type
        )
      }
    }));
  };

  // 아이템 삭제 함수
  const handleDeleteItem = (typeIndex: number, itemIndex: number) => {
    if (!editSettings) return;
    
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: prev!.personality.types.map((type, index) => 
          index === typeIndex 
            ? { 
                ...type, 
                items: (type.items as any[]).filter((_, i) => i !== itemIndex) 
              }
            : type
        )
      }
    }));
  };

  // 타입 삭제 함수
  const handleDeleteType = (typeIndex: number) => {
    setDeleteTypeIndex(typeIndex);
    setShowDeleteTypeModal(true);
  };

  const confirmDeleteType = () => {
    if (deleteTypeIndex === null || !editSettings) return;
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: prev!.personality.types.filter((_, index) => index !== deleteTypeIndex)
      }
    }));
    setShowDeleteTypeModal(false);
    setDeleteTypeIndex(null);
  };

  const cancelDeleteType = () => {
    setShowDeleteTypeModal(false);
    setDeleteTypeIndex(null);
  };

  // 드래그앤드롭 종료 처리
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setEditSettings(prev => {
        if (!prev) return prev;
        
        const oldIndex = prev.personality.types.findIndex((_, index) => `type-${index}` === active.id);
        const newIndex = prev.personality.types.findIndex((_, index) => `type-${index}` === over?.id);
        
        return {
          ...prev,
          personality: {
            ...prev.personality,
            types: arrayMove(prev.personality.types, oldIndex, newIndex)
          }
        };
      });
    }
  };

  // 백업 생성
  const handleCreateBackup = async () => {
    if (!editSettings || !backupName.trim()) return;
    
    try {
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const newBackup: TypeBackup = {
        id: Date.now().toString(),
        name: backupName.trim(),
        date: new Date().toISOString(),
        types: editSettings.personality.types
      };
      
      const backupRef = doc(db, 'global', 'type_backups');
      const backupSnap = await getDoc(backupRef);
      const existingBackups = backupSnap.exists() ? backupSnap.data().backups || [] : [];
      
      await setDoc(backupRef, {
        backups: [...existingBackups, newBackup]
      });
      
      setBackups([...existingBackups, newBackup]);
      setBackupName('');
      setShowBackupModal(false);
      alert('백업이 생성되었습니다.');
    } catch (err) {
      alert('백업 생성 실패: ' + err);
    }
  };

  // 백업 복원
  const handleRestoreBackup = async (backup: TypeBackup) => {
    if (!editSettings) return;
    
    if (window.confirm(`"${backup.name}" 백업을 복원하시겠습니까?`)) {
      setEditSettings(prev => ({
        ...prev!,
        personality: {
          ...prev!.personality,
          types: backup.types
        }
      }));
      setShowRestoreModal(false);
      alert('백업이 복원되었습니다.');
    }
  };

  const handleUpdateMaxSelection = (typeIndex: number, maxSelection: number) => {
    setEditSettings(prev => ({
      ...prev!,
      personality: {
        ...prev!.personality,
        types: prev!.personality.types.map((type, idx) =>
          idx === typeIndex ? { ...type, maxSelection } : type
        )
      }
    }));
  };

  const handleSave = async () => {
    if (!editSettings) return;
    setSaving(true);
    try {
      await GlobalSettingsService.getInstance().invalidateCache();
      const docRef = (await import('firebase/firestore')).doc;
      const setDoc = (await import('firebase/firestore')).setDoc;
      const { db } = await import('../firebase');
      await setDoc(docRef(db, 'global', 'settings'), editSettings);
      await refreshSettings();
      alert('글로벌 설정이 저장되었습니다.');
      // 로그아웃 방지: navigate(-1) 대신 성공 메시지만 표시
    } catch (err) {
      alert('저장 실패: ' + err);
    }
    setSaving(false);
  };

  if (adminRoleLoading) return <div>권한 확인 중...</div>;
  if (adminRole !== 1) return <div>접근 권한이 없습니다.</div>;
  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;
  if (!editSettings) return <div>설정 정보를 불러올 수 없습니다.</div>;

    return (
    <div className={styles.adminContainer}>
      <div className={styles.adminContent}>
        <div className={styles.adminHeader}>
          <h2 className={styles.adminTitle}>글로벌 설정 (어드민 전용)</h2>
          <button onClick={() => navigate(-1)} className={styles.adminBackButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            뒤로
          </button>
        </div>
        
        {/* 세로 기본 지침 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>세로 기본 지침</h3>
          <textarea
            value={editSettings.guidelines.seroGuideline}
            onChange={e => handleChange('guidelines', 'seroGuideline', e.target.value)}
            className={styles.adminInput}
            style={{ minHeight: '100px' }}
            placeholder="세로의 기본 행동 지침을 입력하세요..."
          />
        </div>

        {/* 기본 타입 설정 */}
        <div className={styles.adminSection}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '16px',
              cursor: 'pointer',
              padding: '12px',
              background: 'rgba(245,245,245,0.8)',
              borderRadius: '16px',
              border: '1px solid rgba(144,202,249,0.2)'
            }}
            onClick={() => setDefaultTypeSettingsOpen(!defaultTypeSettingsOpen)}
          >
            <h3 className={styles.adminSectionTitle}>기본 타입 설정 (세로 생성 시 초기값)</h3>
            <span style={{ fontSize: '20px' }}>{defaultTypeSettingsOpen ? '▼' : '▶'}</span>
          </div>
          
          {defaultTypeSettingsOpen && (
            <div style={{ padding: '24px', border: '1px solid rgba(144,202,249,0.1)', borderRadius: '16px', background: 'rgba(250,250,250,0.8)' }}>
              {editSettings.personality.types.map((type, typeIndex) => (
                <div key={typeIndex} style={{ marginBottom: '20px' }}>
                  <h4 className={styles.adminSectionTitle}>{type.categoryName}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {type.type === 'tag' ? (
                      (type.items as string[]).map((item, itemIndex) => {
                        const isSelected = editSettings.personality.defaultTypeSettings[type.categoryName]?.includes(item);
                        return (
                          <span
                            key={itemIndex}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              background: isSelected ? '#1976d2' : 'rgba(227,242,253,0.8)',
                              color: isSelected ? 'white' : '#333',
                              border: '1px solid rgba(144,202,249,0.3)'
                            }}
                            onClick={() => {
                              const currentSelected = editSettings.personality.defaultTypeSettings[type.categoryName] || [];
                              const newSelected = isSelected
                                ? currentSelected.filter(tag => tag !== item)
                                : [...currentSelected, item];
                              handleDefaultTypeSettingChange(type.categoryName, newSelected);
                            }}
                          >
                            {item}
                          </span>
                        );
                      })
                    ) : (
                      (type.items as ExpressionItem[]).map((item, itemIndex) => {
                        const isSelected = editSettings.personality.defaultTypeSettings[type.categoryName]?.includes(item.label);
                        return (
                          <span
                            key={itemIndex}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              background: isSelected ? '#1976d2' : 'rgba(227,242,253,0.8)',
                              color: isSelected ? 'white' : '#333',
                              border: '1px solid rgba(144,202,249,0.3)'
                            }}
                            onClick={() => {
                              const currentSelected = editSettings.personality.defaultTypeSettings[type.categoryName] || [];
                              const newSelected = isSelected
                                ? currentSelected.filter(label => label !== item.label)
                                : [...currentSelected, item.label];
                              handleDefaultTypeSettingChange(type.categoryName, newSelected);
                            }}
                          >
                            {item.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 시스템 설정 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>시스템 설정</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>TMT 비율</label>
              <input
                type="number"
                value={editSettings.system.tmtRatio}
                onChange={e => handleChange('system', 'tmtRatio', Number(e.target.value))}
                className={styles.adminInput}
              />
            </div>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>관계/자아 추출 주기</label>
              <input
                type="number"
                value={editSettings.system.extractInterval}
                onChange={e => handleChange('system', 'extractInterval', Number(e.target.value))}
                className={styles.adminInput}
              />
            </div>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>최대 메시지 길이</label>
              <input
                type="number"
                value={editSettings.system.maxMessageLength}
                onChange={e => handleChange('system', 'maxMessageLength', Number(e.target.value))}
                className={styles.adminInput}
              />
            </div>
          </div>
        </div>

        {/* AI 설정 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>AI 설정</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>AI 모델</label>
              <input
                type="text"
                value={editSettings.ai.model}
                onChange={e => handleChange('ai', 'model', e.target.value)}
                className={styles.adminInput}
              />
            </div>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>Temperature</label>
              <input
                type="number"
                step="0.1"
                value={editSettings.ai.temperature}
                onChange={e => handleChange('ai', 'temperature', Number(e.target.value))}
                className={styles.adminInput}
              />
            </div>
            <div className={styles.adminInputGroup}>
              <label className={styles.adminLabel}>Max Tokens</label>
              <input
                type="number"
                value={editSettings.ai.maxTokens}
                onChange={e => handleChange('ai', 'maxTokens', Number(e.target.value))}
                className={styles.adminInput}
              />
            </div>
          </div>
        </div>

        {/* 타입 관리 */}
        <div className={styles.adminSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className={styles.adminSectionTitle}>타입 관리</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowBackupModal(true)}
                className={styles.adminButton}
              >
                백업 생성
              </button>
              <button 
                onClick={() => setShowRestoreModal(true)}
                className={styles.adminButtonSecondary}
              >
                백업 복원
              </button>
              <button 
                onClick={() => setShowAddTypeModal(true)}
                className={styles.adminButton}
              >
                타입 추가
              </button>
            </div>
          </div>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={editSettings.personality.types.map((_, index) => `type-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              {editSettings.personality.types.map((type, typeIndex) => (
                <SortableTypeItem
                  key={`type-${typeIndex}`}
                  type={type}
                  typeIndex={typeIndex}
                  onDeleteType={handleDeleteType}
                  onAddTagItem={handleAddTagItem}
                  onAddExampleItem={handleAddExampleItem}
                  onDeleteItem={handleDeleteItem}
                  onUpdateMaxSelection={handleUpdateMaxSelection}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* 타입 추가 모달 */}
        {showAddTypeModal && (
          <div className={styles.adminModal}>
            <div className={styles.adminModalContent}>
              <h3 style={{ marginBottom: '16px' }}>새 타입 추가</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.adminLabel}>카테고리명</label>
                <input
                  type="text"
                  value={newTypeData.categoryName}
                  onChange={e => setNewTypeData(prev => ({ ...prev, categoryName: e.target.value }))}
                  placeholder="예: 분위기, 성격, 취미"
                  className={styles.adminInput}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.adminLabel}>타입</label>
                <select
                  value={newTypeData.type}
                  onChange={e => setNewTypeData(prev => ({ ...prev, type: e.target.value as 'tag' | 'example' }))}
                  className={styles.adminInput}
                >
                  <option value="tag">태그형</option>
                  <option value="example">예시형</option>
                </select>
              </div>
              
              {newTypeData.type === 'tag' ? (
                <div style={{ marginBottom: '16px' }}>
                  <label className={styles.adminLabel}>초기 태그 (콤마로 구분)</label>
                  <input
                    type="text"
                    value={newTypeData.tagInput}
                    onChange={e => setNewTypeData(prev => ({ ...prev, tagInput: e.target.value }))}
                    placeholder="예: 어른스러움, 청년스러움, 따뜻함"
                    className={styles.adminInput}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label className={styles.adminLabel}>라벨</label>
                    <input
                      type="text"
                      value={newTypeData.labelInput}
                      onChange={e => setNewTypeData(prev => ({ ...prev, labelInput: e.target.value }))}
                      placeholder="예: 이모티콘 스타일"
                      className={styles.adminInput}
                    />
                  </div>
                  <div>
                    <label className={styles.adminLabel}>예시</label>
                    <input
                      type="text"
                      value={newTypeData.exampleInput}
                      onChange={e => setNewTypeData(prev => ({ ...prev, exampleInput: e.target.value }))}
                      placeholder="예: 😊😂"
                      className={styles.adminInput}
                    />
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowAddTypeModal(false)}
                  className={styles.adminButtonSecondary}
                >
                  취소
                </button>
                <button
                  onClick={handleAddType}
                  className={styles.adminButton}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 백업 생성 모달 */}
        {showBackupModal && (
          <div className={styles.adminModal}>
            <div className={styles.adminModalContent}>
              <h3 style={{ marginBottom: '16px' }}>타입 백업 생성</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.adminLabel}>백업 이름</label>
                <input
                  type="text"
                  value={backupName}
                  onChange={e => setBackupName(e.target.value)}
                  placeholder="예: 2024년 7월 기본 설정"
                  className={styles.adminInput}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowBackupModal(false)}
                  className={styles.adminButtonSecondary}
                >
                  취소
                </button>
                <button
                  onClick={handleCreateBackup}
                  className={styles.adminButton}
                >
                  백업 생성
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 백업 복원 모달 */}
        {showRestoreModal && (
          <div className={styles.adminModal}>
            <div className={styles.adminModalContent}>
              <h3 style={{ marginBottom: '16px' }}>타입 백업 복원</h3>
              
              {backups.length === 0 ? (
                <p>저장된 백업이 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {backups.map(backup => (
                    <div key={backup.id} className={styles.adminBackupItem}>
                      <div style={{ fontWeight: '600' }}>{backup.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {new Date(backup.date).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className={styles.adminButtonSecondary}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 타입 삭제 확인 모달 */}
        {showDeleteTypeModal && (
          <div className={styles.adminModal}>
            <div className={styles.adminModalContent}>
              <h3 style={{ marginBottom: '16px' }}>타입 삭제</h3>
              <p style={{ marginBottom: '24px', color: '#d32f2f' }}>
                타입을 삭제하면 해당 타입에 속한 모든 태그/예시도 함께 삭제됩니다.<br />정말 삭제하시겠습니까?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={cancelDeleteType} className={styles.adminButtonSecondary}>취소</button>
                <button onClick={confirmDeleteType} className={styles.adminButtonDanger}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* 저장/취소 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button onClick={() => navigate(-1)} className={styles.adminButtonSecondary}>취소</button>
          <button onClick={handleSave} disabled={saving} className={styles.adminButton}>저장</button>
        </div>
      </div>
    </div>
  );
};

export default AdminGlobalSettingsPage; 