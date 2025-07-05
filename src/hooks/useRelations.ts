import { useState, useEffect } from 'react';
import { UserRelation, SeroRelation, RelationsExtraction } from '../types';
import { relationsService, metaService } from '../services/firebaseService';
import { extractRelations } from '../services/openaiService';
import { createRelationsExtractionPrompt, mergeRelations } from '../utils/relationUtils';

export const useRelations = (userId: string | null) => {
  const [userRelations, setUserRelations] = useState<UserRelation[] | null>(null);
  const [seroRelations, setSeroRelations] = useState<SeroRelation[] | null>(null);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [messageExtractCount, setMessageExtractCount] = useState(0);

  // 관계도 데이터 로드
  useEffect(() => {
    if (!userId) return;

    const loadRelations = async () => {
      setRelationsLoading(true);
      try {
        const [relationsData, metaData] = await Promise.all([
          relationsService.getRelations(userId),
          metaService.getMeta(userId)
        ]);

        if (relationsData) {
          setUserRelations(relationsData.userRelations);
          setSeroRelations(relationsData.seroRelations);
        } else {
          // 초기 관계도 생성
          await relationsService.createInitialRelations(userId);
          setUserRelations([{ name: "비어있음", type: "비어있음", desc: "비어있음", episodes: ["비어있음"] }]);
          setSeroRelations([{ name: "비어있음", relation: "비어있음", desc: "비어있음", episodes: ["비어있음"] }]);
        }

        if (metaData) {
          setMessageExtractCount(metaData.messageExtractCount);
        }
      } catch (error) {
        console.error('관계도 로드 오류:', error);
        setUserRelations(null);
        setSeroRelations(null);
      }
      setRelationsLoading(false);
    };

    loadRelations();
  }, [userId]);

  // 메시지 추출 카운트 증가 및 관계도 추출
  const incrementMessageExtractCount = async (recentMessages: any[], threshold: number) => {
    if (!userId) return;

    const newCount = messageExtractCount + 1;
    setMessageExtractCount(newCount);
    
    // 메타데이터 업데이트
    await metaService.saveMeta(userId, { messageExtractCount: newCount });

    if (newCount >= threshold) {
      // 관계도 추출 실행
      await extractRelationsFromMessages(recentMessages);
      
      // 카운트 초기화
      setMessageExtractCount(0);
      await metaService.saveMeta(userId, { messageExtractCount: 0 });
    }
  };

  // 메시지에서 관계도 추출
  const extractRelationsFromMessages = async (recentMessages: any[]) => {
    if (!userId) return;

    try {
      // 최근 메시지를 텍스트로 변환
      const chatText = recentMessages
        .map((m, i) => `${i + 1}. ${m.sender === 'user' ? '사용자' : '세로'}: ${m.text}`)
        .join('\n');

      // GPT로 관계도 추출
      const extracted = await extractRelations(chatText);
      
      if (extracted) {
        // 기존 관계도와 병합
        const currentUser = userRelations || [];
        const currentSero = seroRelations || [];
        const merged = mergeRelations(currentUser, currentSero, extracted);

        // Firestore에 저장
        await relationsService.saveRelations(userId, merged);
        
        // 상태 업데이트
        setUserRelations(merged.userRelations);
        setSeroRelations(merged.seroRelations);
      }
    } catch (error) {
      console.error('관계도 추출 오류:', error);
    }
  };

  return {
    userRelations,
    seroRelations,
    relationsLoading,
    messageExtractCount,
    incrementMessageExtractCount,
    extractRelationsFromMessages
  };
}; 