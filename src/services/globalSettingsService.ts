import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GlobalSettings } from '../types';

export class GlobalSettingsService {
  private static instance: GlobalSettingsService;
  private settings: GlobalSettings | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

  private constructor() {}

  static getInstance(): GlobalSettingsService {
    if (!GlobalSettingsService.instance) {
      GlobalSettingsService.instance = new GlobalSettingsService();
    }
    return GlobalSettingsService.instance;
  }

  async getSettings(): Promise<GlobalSettings> {
    // 캐시 확인
    if (this.settings && Date.now() - this.lastFetch < this.CACHE_DURATION) {
      return this.settings;
    }

    try {
      // DB에서 로드
      const docRef = doc(db, 'global', 'settings');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        this.settings = docSnap.data() as GlobalSettings;
      } else {
        // 기본값 설정
        this.settings = this.getDefaultSettings();
      }
      
      this.lastFetch = Date.now();
      return this.settings;
    } catch (error) {
      console.error('글로벌 설정 로드 실패:', error);
      // 오류 시 기본값 반환
      return this.getDefaultSettings();
    }
  }

  // 캐시 무효화 (설정 변경 시 사용)
  invalidateCache(): void {
    this.settings = null;
    this.lastFetch = 0;
  }

  private getDefaultSettings(): GlobalSettings {
    return {
      guidelines: {
        seroGuideline: `당신은 '세로'라는 이름의 AI 어시스턴트입니다. 
        사용자와 자연스럽고 친근한 대화를 나누며, 
        사용자의 질문에 정확하고 도움이 되는 답변을 제공합니다. 
        항상 존댓말을 사용하고, 친근하면서도 전문적인 톤을 유지합니다.`
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
  }
} 