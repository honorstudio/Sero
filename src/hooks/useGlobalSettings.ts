import { useState, useEffect } from 'react';
import { globalService } from '../services/firebaseService';

export const useGlobalSettings = () => {
  const [seroGuideline, setSeroGuideline] = useState('');
  const [seroGuidelineLoading, setSeroGuidelineLoading] = useState(true);
  const [messageExtractThreshold, setMessageExtractThreshold] = useState(2);

  // 글로벌 설정 로드
  useEffect(() => {
    const loadGlobalSettings = async () => {
      setSeroGuidelineLoading(true);
      try {
        const [guideline, threshold] = await Promise.all([
          globalService.getSeroGuideline(),
          globalService.getMessageExtractThreshold()
        ]);
        
        setSeroGuideline(guideline);
        setMessageExtractThreshold(threshold);
      } catch (error) {
        console.error('글로벌 설정 로드 오류:', error);
        setSeroGuideline('');
        setMessageExtractThreshold(2);
      }
      setSeroGuidelineLoading(false);
    };

    loadGlobalSettings();
  }, []);

  return {
    seroGuideline,
    seroGuidelineLoading,
    messageExtractThreshold
  };
}; 