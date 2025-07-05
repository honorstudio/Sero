// 메시지 관련 타입
export interface Message {
  sender: 'user' | 'ai';
  text: string;
  createdAt?: any; // Firestore Timestamp 또는 Date
}

// 페르소나 태그 타입
export interface PersonaTag {
  name: string;
  category: '대형' | '유형';
  type: '분위기' | '성격';
  subtle: boolean;
}

// 감정표현 프리셋 타입
export interface ExpressionPreset {
  key: string;
  label: string;
  example: string;
}

// 사용자 프로필 타입
export interface UserProfile {
  nickname: string;
  photoURL?: string;
}

// AI 프로필 타입
export interface AiProfile {
  name: string;
}

// 캐릭터 프로필 타입
export type ScheduleVariable = {
  type: string; // 예: '운동', '쇼핑', '병원', '특정인물 만남', ...
  time: string; // 예: '18:00'
  desc: string; // 예: '헬스장에서 1시간 운동'
};

export type CharacterSchedule = {
  date: string; // YYYY-MM-DD
  wakeUp: string;
  todo: string;
  meals: string;
  rest: string;
  leisure: string;
  sleep: string;
  variables: ScheduleVariable[];
};

export interface CharacterProfile {
  gender: string;
  job: string;
  description: string;
  age?: string;
  schedule?: CharacterSchedule;
  scheduleVariablePool?: ScheduleVariable[];
}

// 관계도 관련 타입
export interface UserRelation {
  name: string;
  type: string;
  desc?: string;
  episodes: string[];
}

export interface SeroRelation {
  name: string;
  relation: string;
  desc?: string;
  episodes: string[];
}

export interface Place {
  name: string;
  desc?: string;
}

export interface SeroIdentity {
  places?: Place[];
  events?: any[];
  selfNarrative?: string[];
}

// 관계도 추출 결과 타입
export interface RelationsExtraction {
  userRelations?: UserRelation[];
  seroRelations?: SeroRelation[];
  seroIdentity?: SeroIdentity;
}

// 인증 폼 Props 타입
export interface AuthFormProps {
  onAuthSuccess: (user: any) => void;
}

// 파티클 아바타 Props 타입
export interface ParticleAvatarProps {
  size?: number;
  particleCount?: number;
}

// 글로벌 설정 타입 정의
export interface GlobalSettings {
  guidelines: {
    seroGuideline: string;
  };
  personality: {
    // 기본 타입 설정 (세로 생성 시 초기값)
    defaultTypeSettings: {
      [categoryName: string]: string[]; // 카테고리명: 선택된 아이템들
    };
    // 새로운 타입 관리 시스템
    types: PersonalityType[];
    maxMoodTags?: number;
    maxPersonalityTags?: number;
    maxExpressionPrefs?: number;
  };
  system: {
    tmtRatio: number;
    extractInterval: number;
    maxMessageLength: number;
  };
  ai: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

// 새로운 타입 구조
export interface PersonalityType {
  categoryName: string;
  type: 'tag' | 'example';
  items: string[] | ExpressionItem[]; // 태그형은 string[], 예시형은 ExpressionItem[]
  maxSelection?: number; // 타입별 최대 선택 개수
}

// 예시형 아이템 구조
export interface ExpressionItem {
  label: string;
  example: string;
}

// 타입 백업 구조
export interface TypeBackup {
  id: string;
  name: string;
  date: string;
  types: PersonalityType[];
}

// 페르소나 관련 타입 정의
export interface Persona {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  characterProfile: {
    gender: string;
    job: string;
    description: string;
  };
  expressionPrefs: string[];
  tmtRatio: number;
  selfNarrative?: string[]; // 자아 정보 추가
}

// 페르소나 목록 아이템 타입
export interface PersonaListItem {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  messageCount?: number;
  tags: string[];
  characterProfile: {
    gender: string;
    job: string;
    description: string;
  };
}

// 페르소나 생성 요청 타입
export interface CreatePersonaRequest {
  name: string;
  tags: string[];
  expressionPrefs: string[];
  tmtRatio: number;
  characterProfile: {
    gender: string;
    job: string;
    description: string;
  };
}

// 사용자 프로필 타입 정의
export interface UserProfile {
  nickname: string;
  introduction?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 메타데이터 타입
export interface UserMeta {
  messageExtractCount: number;
}

// 프로필 데이터 타입
export interface ProfileData {
  nickname?: string;
  name?: string;
  photoURL?: string;
  personaTags?: string[];
  expressionPrefs?: string[];
  tmtRatio?: number;
  characterGender?: string;
  characterJob?: string;
  characterDescription?: string;
  places?: Place[];
  events?: any[];
  selfNarrative?: string[]; // 자아 정보 추가
}

// 관계도 데이터 타입
export interface RelationsData {
  userRelations: UserRelation[];
  seroRelations: SeroRelation[];
} 