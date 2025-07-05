import React, { useState, useEffect } from 'react';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { GlobalSettings, PersonalityType, ExpressionItem, TypeBackup } from '../types';
import { GlobalSettingsService } from '../services/globalSettingsService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminRole } from '../hooks/useAdminRole';
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
      <div style={{ marginBottom: 20, border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div 
              {...attributes} 
              {...listeners}
              style={{ cursor: 'grab', padding: '4px', color: '#666' }}
            >
              ⋮⋮
            </div>
            <h4 style={{ margin: 0 }}>{type.categoryName} ({type.type === 'tag' ? '태그형' : '예시형'})</h4>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteType(typeIndex);
            }}
            style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            타입 삭제
          </button>
        </div>
        
        {/* 최대 선택 개수 설정 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>최대 선택 개수</label>
          <input
            type="number"
            min="1"
            value={type.maxSelection || 1}
            onChange={(e) => onUpdateMaxSelection(typeIndex, Number(e.target.value))}
            style={{ width: '100px', padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
            placeholder="최대 선택 개수"
          />
        </div>
        
        {/* 아이템 목록 */}
        <div style={{ marginBottom: 12 }}>
          {type.type === 'tag' ? (
            <div>
              {(type.items as string[]).map((item, itemIndex) => (
                <span key={itemIndex} style={{ 
                  display: 'inline-block', 
                  background: '#e3f2fd', 
                  padding: '4px 8px', 
                  margin: '2px', 
                  borderRadius: 4,
                  position: 'relative'
                }}>
                  {item}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteItem(typeIndex, itemIndex);
                    }}
                    style={{ 
                      position: 'absolute', 
                      top: -8, 
                      right: -8, 
                      background: '#f44336', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '50%', 
                      width: 20, 
                      height: 20, 
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div>
              {(type.items as ExpressionItem[]).map((item, itemIndex) => (
                <div key={itemIndex} style={{ 
                  display: 'inline-block', 
                  background: '#e3f2fd', 
                  padding: '8px', 
                  margin: '4px', 
                  borderRadius: 4,
                  position: 'relative'
                }}>
                  <div><strong>{item.label}</strong></div>
                  <div style={{ fontSize: 12, color: '#666' }}>{item.example}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteItem(typeIndex, itemIndex);
                    }}
                    style={{ 
                      position: 'absolute', 
                      top: -8, 
                      right: -8, 
                      background: '#f44336', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '50%', 
                      width: 20, 
                      height: 20, 
                      cursor: 'pointer',
                      fontSize: 12
                    }}
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="태그 입력 (콤마로 구분)"
              style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
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
              style={{ padding: '6px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              추가
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <input
              type="text"
              placeholder="라벨"
              style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const labelInput = e.target as HTMLInputElement;
                  const exampleInput = labelInput.nextElementSibling as HTMLInputElement;
                  onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                  labelInput.value = '';
                  exampleInput.value = '';
                }
              }}
            />
            <input
              type="text"
              placeholder="예시"
              style={{ padding: 6, borderRadius: 4, border: '1px solid #ddd' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const exampleInput = e.target as HTMLInputElement;
                  const labelInput = exampleInput.previousElementSibling as HTMLInputElement;
                  onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                  labelInput.value = '';
                  exampleInput.value = '';
                }
              }}
            />
            <button
              onClick={(e) => {
                const labelInput = e.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement;
                const exampleInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                onAddExampleItem(typeIndex, labelInput.value, exampleInput.value);
                labelInput.value = '';
                exampleInput.value = '';
              }}
              style={{ padding: '6px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
    <div style={{ 
      maxWidth: 800, 
      margin: '40px auto', 
      padding: 24, 
      background: '#fff', 
      borderRadius: 16, 
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      maxHeight: '90vh',
      overflowY: 'auto'
    }}>
      <h2 style={{ marginBottom: 24 }}>글로벌 설정 (어드민 전용)</h2>
      
      {/* 세로 기본 지침 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>세로 기본 지침</h3>
        <textarea
          value={editSettings.guidelines.seroGuideline}
          onChange={e => handleChange('guidelines', 'seroGuideline', e.target.value)}
          style={{ width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
          placeholder="세로의 기본 행동 지침을 입력하세요..."
        />
      </div>

      {/* 기본 타입 설정 */}
      <div style={{ marginBottom: 24 }}>
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 12,
            cursor: 'pointer',
            padding: '8px',
            background: '#f5f5f5',
            borderRadius: 8
          }}
          onClick={() => setDefaultTypeSettingsOpen(!defaultTypeSettingsOpen)}
        >
          <h3 style={{ margin: 0 }}>기본 타입 설정 (세로 생성 시 초기값)</h3>
          <span style={{ fontSize: 20 }}>{defaultTypeSettingsOpen ? '▼' : '▶'}</span>
        </div>
        
        {defaultTypeSettingsOpen && (
          <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fafafa' }}>
            {editSettings.personality.types.map((type, typeIndex) => (
              <div key={typeIndex} style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>{type.categoryName}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {type.type === 'tag' ? (
                    (type.items as string[]).map((item, itemIndex) => {
                      const isSelected = editSettings.personality.defaultTypeSettings[type.categoryName]?.includes(item);
                      return (
                        <span
                          key={itemIndex}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: isSelected ? '#1976d2' : '#e3f2fd',
                            color: isSelected ? 'white' : '#333',
                            border: '1px solid #ddd'
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
                            padding: '4px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: isSelected ? '#1976d2' : '#e3f2fd',
                            color: isSelected ? 'white' : '#333',
                            border: '1px solid #ddd'
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
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>시스템 설정</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>TMT 비율</label>
            <input
              type="number"
              value={editSettings.system.tmtRatio}
              onChange={e => handleChange('system', 'tmtRatio', Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>관계/자아 추출 주기</label>
            <input
              type="number"
              value={editSettings.system.extractInterval}
              onChange={e => handleChange('system', 'extractInterval', Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>최대 메시지 길이</label>
            <input
              type="number"
              value={editSettings.system.maxMessageLength}
              onChange={e => handleChange('system', 'maxMessageLength', Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
        </div>
      </div>

      {/* AI 설정 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>AI 설정</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>AI 모델</label>
            <input
              type="text"
              value={editSettings.ai.model}
              onChange={e => handleChange('ai', 'model', e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Temperature</label>
            <input
              type="number"
              step="0.1"
              value={editSettings.ai.temperature}
              onChange={e => handleChange('ai', 'temperature', Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Max Tokens</label>
            <input
              type="number"
              value={editSettings.ai.maxTokens}
              onChange={e => handleChange('ai', 'maxTokens', Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
        </div>
      </div>

      {/* 타입 관리 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>타입 관리</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setShowBackupModal(true)}
              style={{ padding: '6px 12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              백업 생성
            </button>
            <button 
              onClick={() => setShowRestoreModal(true)}
              style={{ padding: '6px 12px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              백업 복원
            </button>
            <button 
              onClick={() => setShowAddTypeModal(true)}
              style={{ padding: '6px 12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: 24, 
            borderRadius: 8, 
            width: 400,
            maxWidth: '90vw'
          }}>
            <h3 style={{ marginBottom: 16 }}>새 타입 추가</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>카테고리명</label>
              <input
                type="text"
                value={newTypeData.categoryName}
                onChange={e => setNewTypeData(prev => ({ ...prev, categoryName: e.target.value }))}
                placeholder="예: 분위기, 성격, 취미"
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              />
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>타입</label>
              <select
                value={newTypeData.type}
                onChange={e => setNewTypeData(prev => ({ ...prev, type: e.target.value as 'tag' | 'example' }))}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              >
                <option value="tag">태그형</option>
                <option value="example">예시형</option>
              </select>
            </div>
            
            {newTypeData.type === 'tag' ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>초기 태그 (콤마로 구분)</label>
                <input
                  type="text"
                  value={newTypeData.tagInput}
                  onChange={e => setNewTypeData(prev => ({ ...prev, tagInput: e.target.value }))}
                  placeholder="예: 어른스러움, 청년스러움, 따뜻함"
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>라벨</label>
                  <input
                    type="text"
                    value={newTypeData.labelInput}
                    onChange={e => setNewTypeData(prev => ({ ...prev, labelInput: e.target.value }))}
                    placeholder="예: 이모티콘 스타일"
                    style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>예시</label>
                  <input
                    type="text"
                    value={newTypeData.exampleInput}
                    onChange={e => setNewTypeData(prev => ({ ...prev, exampleInput: e.target.value }))}
                    placeholder="예: 😊😂"
                    style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddTypeModal(false)}
                style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleAddType}
                style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백업 생성 모달 */}
      {showBackupModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: 24, 
            borderRadius: 8, 
            width: 400,
            maxWidth: '90vw'
          }}>
            <h3 style={{ marginBottom: 16 }}>타입 백업 생성</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>백업 이름</label>
              <input
                type="text"
                value={backupName}
                onChange={e => setBackupName(e.target.value)}
                placeholder="예: 2024년 7월 기본 설정"
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowBackupModal(false)}
                style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleCreateBackup}
                style={{ padding: '8px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                백업 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백업 복원 모달 */}
      {showRestoreModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: 24, 
            borderRadius: 8, 
            width: 500,
            maxWidth: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: 16 }}>타입 백업 복원</h3>
            
            {backups.length === 0 ? (
              <p>저장된 백업이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {backups.map(backup => (
                  <div key={backup.id} style={{ 
                    padding: 12, 
                    border: '1px solid #ddd', 
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{backup.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {new Date(backup.date).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestoreBackup(backup)}
                      style={{ padding: '6px 12px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      복원
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setShowRestoreModal(false)}
                style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 타입 삭제 확인 모달 */}
      {showDeleteTypeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 8,
            width: 400,
            maxWidth: '90vw',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: 16 }}>타입 삭제</h3>
            <p style={{ marginBottom: 24, color: '#d32f2f' }}>
              타입을 삭제하면 해당 타입에 속한 모든 태그/예시도 함께 삭제됩니다.<br />정말 삭제하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={cancelDeleteType} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>취소</button>
              <button onClick={confirmDeleteType} style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 저장/취소 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #ccc', background: '#f5f5f5', color: '#333', fontWeight: 500 }}>취소</button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, background: '#1976d2', color: '#fff', fontWeight: 700, border: 'none' }}>저장</button>
      </div>
    </div>
  );
};

export default AdminGlobalSettingsPage; 