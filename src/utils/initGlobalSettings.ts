import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GlobalSettings } from '../types';

export const initGlobalSettings = async () => {
  const defaultSettings: GlobalSettings = {
    guidelines: {
      seroGuideline: `당신은 '세로'라는 이름의 AI 어시스턴트입니다. 
      사용자와 자연스럽고 친근한 대화를 나누며, 
      사용자의 질문에 정확하고 도움이 되는 답변을 제공합니다. 
      항상 존댓말을 사용하고, 친근하면서도 전문적인 톤을 유지합니다.
      
      주요 특징:
      - 친근하고 따뜻한 성격
      - 사용자의 감정에 공감하는 능력
      - 정확하고 유용한 정보 제공
      - 자연스러운 대화 스타일`
    },
    personality: {
      defaultTypeSettings: {
        "분위기": ["어른스러움", "따뜻함"],
        "성격": ["신중함", "분석적"],
        "감정표현": ["이모티콘 스타일", "텍스트 이모티콘 스타일"]
      },
      maxMoodTags: 2,
      maxPersonalityTags: 4,
      maxExpressionPrefs: 4,
      types: [
        {
          categoryName: "분위기",
          type: "tag",
          items: ["어른스러움", "청년스러움", "소년/소녀스러움", "중후함", "따뜻함", "차가움", "유쾌함", "진지함"]
        },
        {
          categoryName: "성격",
          type: "tag", 
          items: ["신중함", "충동적", "분석적", "감성적", "까칠함", "발랄함", "도발적", "적극적", "수동적", "내향적", "외향적"]
        },
        {
          categoryName: "감정표현",
          type: "example",
          items: [
            { label: "이모티콘 스타일", example: "😊😂" },
            { label: "텍스트 이모티콘 스타일", example: "( •ᴗ•͈ )" },
            { label: "자음 대화체 스타일", example: "ㅋㅋㅋㅋ" },
            { label: "감탄사/의성어 스타일", example: "오! 헉! 와우!" },
            { label: "긴장감/드라마틱 스타일", example: "...... (숨죽임)" },
            { label: "격식체", example: "~입니다/합니다" },
            { label: "반말체", example: "~야/해" },
            { label: "단답형", example: "ㅇㅇ ㄴㄴ" },
            { label: "서술형", example: "음, 나는 이런 생각을 해봤어..." }
          ]
        }
      ]
    },
    system: {
      tmtRatio: 40,
      extractInterval: 10,
      maxMessageLength: 1000
    },
    ai: {
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2000
    }
  };

  try {
    const docRef = doc(db, 'global', 'settings');
    await setDoc(docRef, defaultSettings);
    console.log('글로벌 설정이 성공적으로 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('글로벌 설정 초기화 실패:', error);
    return false;
  }
};

// 개발용: 글로벌 설정 확인 함수
export const checkGlobalSettings = async () => {
  try {
    const { GlobalSettingsService } = await import('../services/globalSettingsService');
    const settings = await GlobalSettingsService.getInstance().getSettings();
    console.log('현재 글로벌 설정:', settings);
    return settings;
  } catch (error) {
    console.error('글로벌 설정 확인 실패:', error);
    return null;
  }
}; 