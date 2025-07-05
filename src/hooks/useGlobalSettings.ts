import { useState, useEffect } from 'react';
import { GlobalSettingsService } from '../services/globalSettingsService';
import { GlobalSettings } from '../types';

export const useGlobalSettings = () => {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const globalSettings = await GlobalSettingsService.getInstance().getSettings();
        setSettings(globalSettings);
      } catch (err) {
        console.error('글로벌 설정 로드 실패:', err);
        setError('글로벌 설정을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // 캐시 무효화 함수
  const refreshSettings = async () => {
    GlobalSettingsService.getInstance().invalidateCache();
    const globalSettings = await GlobalSettingsService.getInstance().getSettings();
    setSettings(globalSettings);
  };

  return { 
    settings, 
    loading, 
    error, 
    refreshSettings 
  };
}; 