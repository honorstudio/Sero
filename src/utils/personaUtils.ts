import { PersonaTag, ExpressionPreset } from '../types';

// 대형/유형별 카테고리 태그 (나중에 DB로 이동 예정)
export const allTags: PersonaTag[] = [
  // 대형 카테고리(전체적인 인상, 연령대, 분위기)
  { name: '어른스러움', category: '대형', type: '분위기', subtle: false },
  { name: '청년스러움', category: '대형', type: '분위기', subtle: false },
  { name: '소년/소녀스러움', category: '대형', type: '분위기', subtle: false },
  { name: '중후함', category: '대형', type: '분위기', subtle: false },
  { name: '따뜻함', category: '대형', type: '분위기', subtle: false },
  { name: '차가움', category: '대형', type: '분위기', subtle: false },
  { name: '유쾌함', category: '대형', type: '분위기', subtle: false },
  { name: '진지함', category: '대형', type: '분위기', subtle: false },
  // 유형별 카테고리(구체적 성격, 행동, 말투)
  { name: '신중함', category: '유형', type: '성격', subtle: false },
  { name: '충동적', category: '유형', type: '성격', subtle: false },
  { name: '분석적', category: '유형', type: '성격', subtle: false },
  { name: '감성적', category: '유형', type: '성격', subtle: false },
  { name: '까칠함', category: '유형', type: '성격', subtle: false },
  { name: '발랄함', category: '유형', type: '성격', subtle: false },
  { name: '도발적', category: '유형', type: '성격', subtle: false },
  { name: '적극적', category: '유형', type: '성격', subtle: false },
  { name: '수동적', category: '유형', type: '성격', subtle: false },
  { name: '내향적', category: '유형', type: '성격', subtle: false },
  { name: '외향적', category: '유형', type: '성격', subtle: false },
];

// 감정표현 방식 프리셋 (나중에 DB로 이동 예정)
export const expressionPresets: ExpressionPreset[] = [
  { key: 'emoji', label: '이모티콘 스타일', example: '😊😂' },
  { key: 'textEmoticon', label: '텍스트 이모티콘 스타일', example: '( •ᴗ•͈ )' },
  { key: 'consonant', label: '자음 대화체 스타일', example: 'ㅋㅋㅋㅋ' },
  { key: 'exclaim', label: '감탄사/의성어 스타일', example: '오! 헉! 와우!' },
  { key: 'dramatic', label: '긴장감/드라마틱 스타일', example: '...... (숨죽임)' },
  { key: 'formal', label: '격식체', example: '~입니다/합니다' },
  { key: 'banmal', label: '반말체', example: '~야/해' },
  { key: 'short', label: '단답형', example: 'ㅇㅇ ㄴㄴ' },
  { key: 'long', label: '서술형', example: '음, 나는 이런 생각을 해봤어...' },
];

// 감정표현 key -> label 매핑 함수
export const getExpressionLabels = (keys: string[]): string[] => {
  return expressionPresets
    .filter(preset => keys.includes(preset.key))
    .map(preset => preset.label);
};

// 태그를 카테고리별로 분류
export const getTagsByCategory = (tags: string[]): { [category: string]: string[] } => {
  const categoryMap: { [category: string]: string[] } = {};
  tags.forEach(tag => {
    const found = allTags.find(t => t.name === tag);
    if (found) {
      if (!categoryMap[found.type]) categoryMap[found.type] = [];
      categoryMap[found.type].push(tag);
    } else {
      if (!categoryMap['기타']) categoryMap['기타'] = [];
      categoryMap['기타'].push(tag);
    }
  });
  return categoryMap;
};

// TMT 비율에 따른 답변 길이 지시 생성
export const getTmtInstruction = (tmtRatio: number): string => {
  if (tmtRatio <= 20) {
    return '매우 간결하게 답변해. 한 문장으로 끝내는 것을 선호해.';
  } else if (tmtRatio <= 40) {
    return '간결하게 답변해. 2-3문장 정도로 답변해.';
  } else if (tmtRatio <= 60) {
    return '적당한 길이로 답변해. 3-5문장 정도로 답변해.';
  } else if (tmtRatio <= 80) {
    return '자세하게 답변해. 5-8문장 정도로 답변해.';
  } else {
    return '매우 자세하게 답변해. 8문장 이상으로 상세하게 설명해.';
  }
}; 