import { useState, useEffect } from 'react';
import { AiProfile, CharacterProfile, ProfileData } from '../types';
import { profileService } from '../services/firebaseService';
import { generateCharacterInfo, generateNameGiftResponse } from '../services/openaiService';

export const useProfile = (userId: string | null) => {
  const [aiProfile, setAiProfile] = useState<AiProfile | null>(null);
  const [personaTags, setPersonaTags] = useState<string[]>([]);
  const [expressionPrefs, setExpressionPrefs] = useState<string[]>([]);
  const [tmtRatio, setTmtRatio] = useState<number>(50);
  const [characterProfile, setCharacterProfile] = useState<CharacterProfile>({
    gender: '',
    job: '',
    description: ''
  });
  const [characterGenLoading, setCharacterGenLoading] = useState(false);
  const [characterGenError, setCharacterGenError] = useState('');

  // 프로필 데이터 로드
  useEffect(() => {
    if (!userId) return;

    const loadProfile = async () => {
      try {
        const profile = await profileService.getProfile(userId);
        if (profile) {
          setAiProfile({ name: profile.name || '세로' });
          setPersonaTags(profile.personaTags || ['유쾌함', '진지함']);
          setExpressionPrefs(profile.expressionPrefs || []);
          setTmtRatio(profile.tmtRatio || 50);
          setCharacterProfile({
            gender: profile.characterGender || '',
            job: profile.characterJob || '',
            description: profile.characterDescription || ''
          });
        } else {
          // 기본값 설정
          setAiProfile({ name: '세로' });
          setPersonaTags(['유쾌함', '진지함']);
          setExpressionPrefs([]);
          setTmtRatio(50);
          setCharacterProfile({ gender: '', job: '', description: '' });
        }
      } catch (error) {
        console.error('프로필 로드 오류:', error);
      }
    };

    loadProfile();
  }, [userId]);

  // 태그 업데이트
  const updateTags = async (tags: string[]) => {
    setPersonaTags(tags);
    if (userId) {
      await profileService.saveProfile(userId, { personaTags: tags });
    }
  };

  // 감정표현 업데이트
  const updateExpressionPrefs = async (prefs: string[]) => {
    setExpressionPrefs(prefs);
    if (userId) {
      await profileService.saveProfile(userId, { expressionPrefs: prefs });
    }
  };

  // TMT 비율 업데이트
  const updateTmtRatio = async (ratio: number) => {
    setTmtRatio(ratio);
    if (userId) {
      await profileService.saveProfile(userId, { tmtRatio: ratio });
    }
  };

  // 캐릭터 정보 자동생성
  const autoGenerateCharacter = async () => {
    setCharacterGenLoading(true);
    setCharacterGenError('');
    
    try {
      const characterInfo = await generateCharacterInfo(personaTags, expressionPrefs);
      setCharacterProfile(characterInfo);
      
      // Firestore에 저장
      if (userId) {
        await profileService.saveProfile(userId, {
          characterGender: characterInfo.gender,
          characterJob: characterInfo.job,
          characterDescription: characterInfo.description
        });
      }
    } catch (error) {
      setCharacterGenError('캐릭터 자동생성 중 오류가 발생했습니다.');
      console.error('캐릭터 생성 오류:', error);
    }
    
    setCharacterGenLoading(false);
  };

  // 캐릭터 정보 수동 업데이트
  const updateCharacterProfile = async (profile: Partial<CharacterProfile>) => {
    const newProfile = { ...characterProfile, ...profile };
    setCharacterProfile(newProfile);
    
    if (userId) {
      await profileService.saveProfile(userId, {
        characterGender: newProfile.gender,
        characterJob: newProfile.job,
        characterDescription: newProfile.description
      });
    }
  };

  // AI 이름 변경
  const updateAiName = async (newName: string) => {
    if (!userId) return;

    try {
      await profileService.saveProfile(userId, { name: newName });
      setAiProfile({ name: newName });

      // 이름 선물 감격 응답 생성
      const response = await generateNameGiftResponse(personaTags, expressionPrefs, tmtRatio, newName);
      return response;
    } catch (error) {
      console.error('AI 이름 업데이트 오류:', error);
      throw error;
    }
  };

  return {
    aiProfile,
    personaTags,
    expressionPrefs,
    tmtRatio,
    characterProfile,
    characterGenLoading,
    characterGenError,
    updateTags,
    updateExpressionPrefs,
    updateTmtRatio,
    autoGenerateCharacter,
    updateCharacterProfile,
    updateAiName
  };
}; 