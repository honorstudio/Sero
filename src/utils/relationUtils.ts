import { UserRelation, SeroRelation, RelationsExtraction } from '../types';

// 관계도 요약 텍스트 생성 함수
export const getRelationsSummary = (
  userRelations: UserRelation[] | null, 
  seroRelations: SeroRelation[] | null
): string => {
  let summary = '';
  
  if (userRelations && userRelations.length > 0) {
    summary += '[사용자 관계도]\n';
    userRelations.forEach((rel) => {
      summary += `${rel.name}(${rel.type}): ${rel.desc || ''}`;
      if (rel.episodes && rel.episodes.length > 0) {
        summary += `, 에피소드: ${rel.episodes.join('; ')}`;
      }
      summary += '\n';
    });
  }
  
  if (seroRelations && seroRelations.length > 0) {
    summary += '[세로의 가상 관계도]\n';
    seroRelations.forEach((char) => {
      summary += `${char.name}(${char.relation}): ${char.desc || ''}`;
      if (char.episodes && char.episodes.length > 0) {
        summary += `, 에피소드: ${char.episodes.join('; ')}`;
      }
      summary += '\n';
    });
  }
  
  return summary.trim();
};

// 관계도 추출을 위한 GPT 프롬프트 생성
export const createRelationsExtractionPrompt = (chatText: string): string => {
  return `아래는 최근 대화 내용입니다.\n\n[대화]\n${chatText}\n\n[요청]\n- 사용자와 세로의 대화에서 등장한 인물, 관계, 사건, 공간을 각각 분류해서 JSON으로 정리해줘.\n- 세로가 말한 자기서사/세계관(자아 정보)은 별도로 정리해줘.\n\n[출력 예시]\n{\n  "userRelations": [\n    { "name": "엄마", "type": "가족", "desc": "밥을 먹음", "episodes": ["밥 먹음"] }\n  ],\n  "seroRelations": [\n    { "name": "로라", "relation": "친구", "desc": "항상 도와줌", "episodes": ["도와줌"] }\n  ],\n  "seroIdentity": {\n    "places": [ { "name": "별빛마을", "desc": "세로가 자란 곳" } ],\n    "events": [],\n    "selfNarrative": ["나는 별빛마을에서 자랐어"]\n  }\n}`;
};

// 관계도 데이터 병합 (중복 제거 및 에피소드 누적)
export const mergeRelations = (
  prevUser: UserRelation[], 
  prevSero: SeroRelation[], 
  extracted: RelationsExtraction
): { userRelations: UserRelation[], seroRelations: SeroRelation[] } => {
  let newUser = [...prevUser];
  let newSero = [...prevSero];

  // 첫 저장 시 '비어있음' 데이터 모두 제거
  if (newUser.length === 1 && newUser[0].name === "비어있음") newUser = [];
  if (newSero.length === 1 && newSero[0].name === "비어있음") newSero = [];

  // 사용자 관계 누적 (동일 인물+관계면 에피소드만 추가)
  if (extracted.userRelations && Array.isArray(extracted.userRelations)) {
    extracted.userRelations.forEach((rel) => {
      const idx = newUser.findIndex((r) => r.name === rel.name && r.type === rel.type);
      if (idx >= 0) {
        const currentEpisodes = newUser[idx].episodes || [];
        const newEpisodes = rel.episodes || [];
        newUser[idx].episodes = Array.from(new Set([...currentEpisodes, ...newEpisodes]));
        if (rel.desc) newUser[idx].desc = rel.desc;
      } else {
        newUser.push(rel);
      }
    });
  }

  // 세로 관계 누적 (동일 인물+관계면 에피소드만 추가)
  if (extracted.seroRelations && Array.isArray(extracted.seroRelations)) {
    extracted.seroRelations.forEach((rel) => {
      const idx = newSero.findIndex((r) => r.name === rel.name && r.relation === rel.relation);
      if (idx >= 0) {
        const currentEpisodes = newSero[idx].episodes || [];
        const newEpisodes = rel.episodes || [];
        newSero[idx].episodes = Array.from(new Set([...currentEpisodes, ...newEpisodes]));
        if (rel.desc) newSero[idx].desc = rel.desc;
      } else {
        newSero.push(rel);
      }
    });
  }

  return { userRelations: newUser, seroRelations: newSero };
}; 