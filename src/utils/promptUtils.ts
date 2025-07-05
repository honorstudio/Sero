import { CharacterProfile } from '../types';
import { getTagsByCategory, getExpressionLabels, getTmtInstruction } from './personaUtils';
import { getTimeInstruction } from './messageUtils';
import { getRelationsSummary } from './relationUtils';

// 시스템 프롬프트 생성 함수
export const createSystemPrompt = (
  tags: string[],
  exprs: string[],
  tmt: number,
  charProf: CharacterProfile,
  nickname: string,
  guideline: string,
  userRelations: any,
  seroRelations: any,
  messages: any[]
): string => {
  const aiName = '세로'; // 기본값, 나중에 동적으로 변경 가능
  const userName = nickname;
  
  // 유효한 태그만 사용
  const validTags = tags.filter(tag => 
    ['어른스러움', '청년스러움', '소년/소녀스러움', '중후함', '따뜻함', '차가움', '유쾌함', '진지함', 
     '신중함', '충동적', '분석적', '감성적', '까칠함', '발랄함', '도발적', '적극적', '수동적', '내향적', '외향적'].includes(tag)
  );
  
  const validExprs = exprs.filter(expr => 
    ['emoji', 'textEmoticon', 'consonant', 'exclaim', 'dramatic', 'formal', 'banmal', 'short', 'long'].includes(expr)
  );
  
  const tagCategories = getTagsByCategory(validTags);
  const exprLabels = getExpressionLabels(validExprs);
  
  let tagDesc = Object.entries(tagCategories)
    .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
    .join(' / ');
  if (!tagDesc) tagDesc = '없음';
  
  const exprDesc = exprLabels.length > 0 ? exprLabels.join(', ') : '없음';
  const tmtInstruction = getTmtInstruction(tmt);
  
  // 캐릭터 프로필 설명 추가
  let charProfileDesc = '';
  if (charProf.gender || charProf.job || charProf.description) {
    charProfileDesc = `\n[캐릭터 정보]\n성별: ${charProf.gender || '미정'}\n직업: ${charProf.job || '미정'}\n설명: ${charProf.description || '없음'}`;
  }
  
  // 관계도 요약 추가
  const relationsSummary = getRelationsSummary(userRelations, seroRelations);
  
  // 현재 시간 고려 안내
  const timeInstruction = getTimeInstruction();

  const prompt =
    (guideline ? `[세로의 기본 지침]\n${guideline}\n\n` : '') +
    (relationsSummary ? relationsSummary + '\n\n' : '') +
    `너는 감정형 페르소나 AI야. 네 이름은 "${aiName}"이고, 사용자의 닉네임은 "${userName}"이야.\n` +
    `항상 본인 이름으로 자신을 지칭하고, 사용자를 부를 때는 "${userName}"이라고 불러.\n` +
    `다음과 같은 성격과 감정표현 방식을 가지고 있어.\n` +
    `성격/분위기 태그: ${tagDesc}\n` +
    `감정표현 방식: ${exprDesc}\n` +
    `답변 길이: ${tmtInstruction}${charProfileDesc}\n` +
    `${timeInstruction}\n` +
    `항상 위의 성격과 감정표현을 유지해서 자연스럽고 일관성 있게 답변해. (태그/감정표현/캐릭터 정보/관계도가 바뀌면 그에 맞게 말투와 분위기도 바뀌어야 해.)`;
    
  return prompt;
}; 