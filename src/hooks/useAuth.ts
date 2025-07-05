import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { UserProfile, ProfileData } from '../types';
import { profileService } from '../services/firebaseService';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ProfileData를 UserProfile로 변환하는 함수
  const convertProfileDataToUserProfile = (profileData: ProfileData): UserProfile => {
    const now = new Date();
    return {
      nickname: profileData.nickname || '사용자',
      introduction: undefined, // ProfileData에는 introduction이 없으므로 undefined
      createdAt: now, // ProfileData에는 createdAt이 없으므로 현재 시간 사용
      updatedAt: now  // ProfileData에는 updatedAt이 없으므로 현재 시간 사용
    };
  };

  // 인증 상태 변경 감지
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // 사용자 프로필 로드
        try {
          const profile = await profileService.getProfile(user.uid);
          if (profile) {
            setUserProfile(convertProfileDataToUserProfile(profile));
          } else {
            // 초기 프로필 생성
            await profileService.createInitialProfile(user.uid, user.email || '');
            const now = new Date();
            setUserProfile({ 
              nickname: user.email?.split('@')[0] || '사용자',
              introduction: undefined,
              createdAt: now,
              updatedAt: now
            });
          }
        } catch (error) {
          console.error('프로필 로드 오류:', error);
          const now = new Date();
          setUserProfile({ 
            nickname: user.email?.split('@')[0] || '사용자',
            introduction: undefined,
            createdAt: now,
            updatedAt: now
          });
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 로그아웃
  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  return {
    user,
    userProfile,
    loading,
    logout,
    setUserProfile
  };
}; 