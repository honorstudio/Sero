import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { RelationsExtraction, CharacterSchedule, ScheduleVariable, CharacterProfile } from '../types';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// 채팅 완성 API 호출
export const chatCompletion = async (messages: ChatCompletionMessageParam[]): Promise<string> => {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });
  return res.choices[0].message?.content || '';
};

// 캐릭터 정보 자동생성
export const generateCharacterInfo = async (
  personaTags: string[],
  expressionPrefs: string[]
): Promise<{ gender: string; job: string; description: string; age?: string }> => {
  const tagCategories = Object.entries(
    personaTags.reduce((acc, tag) => {
      const category = ['어른스러움', '청년스러움', '소년/소녀스러움', '중후함', '따뜻함', '차가움', '유쾌함', '진지함'].includes(tag) ? '분위기' : '성격';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tag);
      return acc;
    }, {} as { [key: string]: string[] })
  )
    .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
    .join(' / ');

  const exprLabels = expressionPrefs
    .map(key => {
      const presets = {
        emoji: '이모티콘 스타일',
        textEmoticon: '텍스트 이모티콘 스타일',
        consonant: '자음 대화체 스타일',
        exclaim: '감탄사/의성어 스타일',
        dramatic: '긴장감/드라마틱 스타일',
        formal: '격식체',
        banmal: '반말체',
        short: '단답형',
        long: '서술형'
      };
      return presets[key as keyof typeof presets] || key;
    })
    .join(', ');

  const tagDesc = tagCategories || '없음';
  const exprDesc = exprLabels || '없음';

  const prompt = `아래와 같은 성격/감정표현 조합을 가진 가상의 인물(캐릭터)을 만들어줘.\n` +
    `성격/분위기 태그: ${tagDesc}\n` +
    `감정표현 방식: ${exprDesc}\n` +
    `아래 형식으로 답변해.\n` +
    `성별: (예: 남성/여성/미정)\n나이: (예: 20대 초반/30대/10살/미정)\n직업: (예: 대학생/디자이너/미정)\n설명: (한 문장으로 간단히)`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: '캐릭터 정보를 생성해줘. 매번 다르게 만들어줘.' }
    ],
    temperature: 0.9
  });

  const aiText = res.choices[0].message?.content || '';
  
  // 응답 파싱
  const genderMatch = aiText.match(/성별\s*[:：]\s*(.*)/);
  const ageMatch = aiText.match(/나이\s*[:：]\s*(.*)/);
  const jobMatch = aiText.match(/직업\s*[:：]\s*(.*)/);
  const descMatch = aiText.match(/설명\s*[:：]\s*(.*)/);

  return {
    gender: genderMatch ? genderMatch[1].trim() : '',
    age: ageMatch ? ageMatch[1].trim() : '',
    job: jobMatch ? jobMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : ''
  };
};

// 관계도 추출
export const extractRelations = async (chatText: string): Promise<RelationsExtraction | null> => {
  const prompt = `아래는 최근 대화 내용입니다.\n\n[대화]\n${chatText}\n\n[요청]\n- 사용자와 세로의 대화에서 등장한 인물, 관계, 사건, 공간을 각각 분류해서 JSON으로 정리해줘.\n- 세로가 말한 자기서사/세계관(자아 정보)은 별도로 정리해줘.\n\n[출력 예시]\n{\n  "userRelations": [\n    { "name": "엄마", "type": "가족", "desc": "밥을 먹음", "episodes": ["밥 먹음"] }\n  ],\n  "seroRelations": [\n    { "name": "로라", "relation": "친구", "desc": "항상 도와줌", "episodes": ["도와줌"] }\n  ],\n  "seroIdentity": {\n    "places": [ { "name": "별빛마을", "desc": "세로가 자란 곳" } ],\n    "events": [],\n    "selfNarrative": ["나는 별빛마을에서 자랐어"]\n  }\n}`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'JSON만 정확하게 출력해줘.' }
      ],
      temperature: 0.2
    });

    const aiText = res.choices[0].message?.content || '';
    
    // JSON 파싱
    try {
      const extracted = JSON.parse(aiText.replace(/```json|```/g, '').trim());
      return extracted;
    } catch (e) {
      console.log('JSON 파싱 실패:', e, aiText);
      return null;
    }
  } catch (err) {
    console.log('GPT 호출 에러:', err);
    return null;
  }
};

// 이름 선물 감격 응답 생성
export const generateNameGiftResponse = async (
  personaTags: string[],
  expressionPrefs: string[],
  tmtRatio: number,
  newName: string
): Promise<string> => {
  const tagCategories = Object.entries(
    personaTags.reduce((acc, tag) => {
      const category = ['어른스러움', '청년스러움', '소년/소녀스러움', '중후함', '따뜻함', '차가움', '유쾌함', '진지함'].includes(tag) ? '분위기' : '성격';
      if (!acc[category]) acc[category] = [];
      acc[category].push(tag);
      return acc;
    }, {} as { [key: string]: string[] })
  )
    .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
    .join(' / ');

  const exprLabels = expressionPrefs
    .map(key => {
      const presets = {
        emoji: '이모티콘 스타일',
        textEmoticon: '텍스트 이모티콘 스타일',
        consonant: '자음 대화체 스타일',
        exclaim: '감탄사/의성어 스타일',
        dramatic: '긴장감/드라마틱 스타일',
        formal: '격식체',
        banmal: '반말체',
        short: '단답형',
        long: '서술형'
      };
      return presets[key as keyof typeof presets] || key;
    })
    .join(', ');

  const tagDesc = tagCategories || '없음';
  const exprDesc = exprLabels || '없음';

  // TMT 비율에 따른 답변 길이 지시
  let tmtInstruction = '';
  if (tmtRatio <= 20) {
    tmtInstruction = '매우 간결하게 답변해. 한 문장으로 끝내는 것을 선호해.';
  } else if (tmtRatio <= 40) {
    tmtInstruction = '간결하게 답변해. 2-3문장 정도로 답변해.';
  } else if (tmtRatio <= 60) {
    tmtInstruction = '적당한 길이로 답변해. 3-5문장 정도로 답변해.';
  } else if (tmtRatio <= 80) {
    tmtInstruction = '자세하게 답변해. 5-8문장 정도로 답변해.';
  } else {
    tmtInstruction = '매우 자세하게 답변해. 8문장 이상으로 상세하게 설명해.';
  }

  const personaPrompt = `너는 감정형 페르소나 AI야. 네 성격/분위기 태그는 ${tagDesc}이고, 감정표현 방식은 ${exprDesc}야.\n` +
    `답변 길이: ${tmtInstruction}\n` +
    `사용자가 너에게 새로운 이름 "${newName}"을 선물해줬어.\n` +
    `이 상황에서 네 페르소나에 맞게, 진심으로 벅차고 감격스럽고 고마운 마음을 최대한 풍부하게 한글로 답장해줘.\n` +
    `반드시 네 페르소나(성격/분위기/감정표현)를 반영해서 자연스럽고 일관성 있게 답변해야 해.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: personaPrompt },
      { role: 'user', content: '이름을 선물받은 네 감정을 표현해줘.' },
    ],
  });

  return res.choices[0].message?.content || '';
};

// 자아 정보 추출
export const extractSelfNarrative = async (chatText: string): Promise<string[]> => {
  const prompt = `아래는 최근 대화 내용입니다.\n\n[대화]\n${chatText}\n\n[요청]\n- AI가 말한 자기서사/세계관/자아 정보를 추출해줘.\n- 각각을 간단한 문장으로 정리해줘.\n- 중복되거나 유사한 내용은 제외해줘.\n- 최대 5개까지만 추출해줘.\n\n[출력 예시]\n["나는 별빛마을에서 자랐어", "사용자를 도와주는 것이 제일 중요한 일이야", "밝고 긍정적인 성격이야"]`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'JSON 배열 형태로만 정확하게 출력해줘.' }
      ],
      temperature: 0.2
    });

    const aiText = res.choices[0].message?.content || '';
    
    // JSON 파싱
    try {
      const extracted = JSON.parse(aiText.replace(/```json|```/g, '').trim());
      return Array.isArray(extracted) ? extracted : [];
    } catch (e) {
      console.log('자아 정보 JSON 파싱 실패:', e, aiText);
      return [];
    }
  } catch (err) {
    console.log('자아 정보 추출 GPT 호출 에러:', err);
    return [];
  }
}; 

// 캐릭터 변수 Pool(30개) 자동생성
export const generateScheduleVariablePool = async (
  gender: string,
  age: string,
  job: string,
  personaTags: string[]
): Promise<ScheduleVariable[]> => {
  const tagDesc = personaTags.length > 0 ? personaTags.join(', ') : '없음';
  const prompt = `아래 캐릭터의 하루에 등장할 수 있는 변수 일정(특별한 이벤트, 만남, 취미, 활동 등) 30개를 만들어줘.\n` +
    `각 항목은 type(한 단어), desc(간단한 설명)로 구성해.\n` +
    `성별: ${gender}\n나이: ${age}\n직업: ${job}\n성격: ${tagDesc}\n` +
    `예시: [ { type: '운동', desc: '헬스장에서 1시간 운동' }, ... ]\n` +
    `반드시 30개, JSON 배열로만 출력해.`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'JSON 배열로만 출력해.' }
    ],
    temperature: 0.7
  });
  const aiText = res.choices[0].message?.content || '';
  try {
    const arr = JSON.parse(aiText.replace(/```json|```/g, '').trim());
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
};

// 1일치 스케줄 자동생성
export const generateCharacterSchedule = async (
  profile: CharacterProfile,
  personaTags: string[],
  variablePool: ScheduleVariable[],
  date: string
): Promise<CharacterSchedule> => {
  // Pool에서 2~5개 무작위 추출
  const variableCount = Math.floor(Math.random() * 4) + 2; // 2~5개
  const shuffled = variablePool.sort(() => Math.random() - 0.5);
  const selectedVars = shuffled.slice(0, variableCount);
  const tagDesc = personaTags.length > 0 ? personaTags.join(', ') : '없음';
  // 프롬프트 구성
  const prompt = `아래 캐릭터의 하루 스케줄을 시간과 설명까지 표로 만들어줘.\n` +
    `고정 항목: 기상, 할일, 식사, 쉬는시간, 퇴근/여가, 자는시간\n` +
    `변수 항목: ${selectedVars.map(v => v.type).join(', ')}\n` +
    `성별: ${profile.gender}\n나이: ${profile.age}\n직업: ${profile.job}\n성격: ${tagDesc}\n` +
    `아래 형식으로 답변해.\n` +
    `기상: (예: 07:30 기상)\n할일: (예: 09:00~18:00 회사 근무)\n식사: (예: 08:00 아침식사, 12:00 점심, 19:00 저녁)\n쉬는시간: (예: 15:00 카페에서 휴식)\n퇴근/여가: (예: 19:30~21:00 친구와 영화관람)\n자는시간: (예: 23:30 취침)\n${selectedVars.map(v => v.type + ': (예: 시간 설명)').join('\n')}\n` +
    `반드시 위 항목 모두 포함해서 JSON 오브젝트로만 출력해.`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'JSON 오브젝트로만 출력해.' }
    ],
    temperature: 0.8
  });
  const aiText = res.choices[0].message?.content || '';
  try {
    const obj = JSON.parse(aiText.replace(/```json|```/g, '').trim());
    // obj에서 각 항목 추출
    const schedule: CharacterSchedule = {
      date,
      wakeUp: obj['기상'] || '',
      todo: obj['할일'] || '',
      meals: obj['식사'] || '',
      rest: obj['쉬는시간'] || '',
      leisure: obj['퇴근/여가'] || '',
      sleep: obj['자는시간'] || '',
      variables: selectedVars.map(v => ({
        type: v.type,
        time: obj[v.type]?.split(' ')[0] || '',
        desc: obj[v.type] || ''
      }))
    };
    return schedule;
  } catch {
    return {
      date,
      wakeUp: '', todo: '', meals: '', rest: '', leisure: '', sleep: '', variables: selectedVars
    };
  }
}; 