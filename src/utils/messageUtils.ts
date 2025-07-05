// 문장 분리 함수 (마침표, 물음표, 느낌표 뒤 공백/줄바꿈 기준)
export const splitSentences = (text: string): string[] => {
  // 정규식: 문장부호(.,!,?) 뒤 공백/줄바꿈 기준 분리, 빈 문장 제거
  return text
    .split(/(?<=[.!?])[\s\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
};

// 현재 시간 한글 포맷 + 타임존 생성
export const getCurrentTimeString = (date: Date = new Date()): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -date.getTimezoneOffset() / 60;
  const offsetStr = (offset >= 0 ? '+' : '') + offset;
  const hour = date.getHours();
  const ampm = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]}) ${ampm} ${hour12}시 ${date.getMinutes()}분 (${tz}, GMT${offsetStr})`;
};

// 시간+스케줄 고려 안내 생성
export const getTimeInstruction = (date: Date = new Date()): string => {
  const nowStr = getCurrentTimeString(date);
  return `지금은 ${nowStr}입니다. 반드시 현재 시간과 너의 직업, 라이프스타일, 스케줄을 고려해서 답변해. 예를 들어 네가 회사원이라면 점심시간엔 점심을 먹고 있다거나, 바텐더라면 새벽에 일하고 오전엔 자고 있다거나, 학생이면 수업 중일 수 있다는 식으로, 시간대와 네 페르소나의 일상/스케줄을 자연스럽게 반영해서 답변해.`;
};

// 메시지 시간 포맷팅
export const formatMessageTime = (date: Date | any): string => {
  if (!date) return '';
  
  // Firestore Timestamp인 경우 Date로 변환
  const messageDate = typeof date.toDate === 'function' ? date.toDate() : date;
  
  return messageDate.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
}; 