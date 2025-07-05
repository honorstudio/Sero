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
export interface CharacterProfile {
  gender: string;
  job: string;
  description: string;
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

// 글로벌 설정 타입
export interface GlobalSettings {
  seroGuideline?: string;
  messageExtractThreshold?: number;
  defaultTmtRatio?: number;
  personaTags?: PersonaTag[];
  expressionPresets?: ExpressionPreset[];
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
  selfNarrative?: string[];
}

// 관계도 데이터 타입
export interface RelationsData {
  userRelations: UserRelation[];
  seroRelations: SeroRelation[];
} 