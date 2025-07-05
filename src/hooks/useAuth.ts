import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { profileService } from '../services/firebaseService';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
            setUserProfile({ 
              nickname: profile.nickname || '사용자',
              photoURL: profile.photoURL 
            });
          } else {
            // 초기 프로필 생성
            await profileService.createInitialProfile(user.uid, user.email || '');
            setUserProfile({ 
              nickname: user.email?.split('@')[0] || '사용자',
              photoURL: user.photoURL || undefined
            });
          }
        } catch (error) {
          console.error('프로필 로드 오류:', error);
          setUserProfile({ 
            nickname: user.email?.split('@')[0] || '사용자',
            photoURL: user.photoURL || undefined
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