// 디버그 모드 설정
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// 디버그 로그 함수
export const debugLog = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    if (data) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
};

// 시스템 프롬프트 디버그
export const debugSystemPrompt = (persona: any, systemPrompt: string) => {
  if (DEBUG_MODE) {
    console.log('=== 시스템 프롬프트 디버깅 ===');
    console.log('페르소나 객체:', persona);
    console.log('생성된 시스템 프롬프트:', systemPrompt);
    console.log('==============================');
  }
};

// 에러 로그 (항상 출력)
export const errorLog = (message: string, error?: any) => {
  if (error) {
    console.error(`[ERROR] ${message}`, error);
  } else {
    console.error(`[ERROR] ${message}`);
  }
};

// 성능 측정
export const measurePerformance = (name: string, fn: () => any) => {
  if (DEBUG_MODE) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[PERF] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return fn();
}; 