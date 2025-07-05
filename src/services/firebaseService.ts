import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  limit, 
  startAfter, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Message, ProfileData, RelationsData, UserMeta, PersonaListItem, Persona, CreatePersonaRequest, CharacterSchedule, ScheduleVariable } from '../types';

// 메시지 관련 서비스
export const messageService = {
  // 메시지 저장
  async saveMessage(userId: string, personaId: string, message: Message): Promise<void> {
    await addDoc(
      collection(db, 'chats', userId, 'personas', personaId, 'messages'),
      {
        sender: message.sender,
        text: message.text,
        createdAt: serverTimestamp(),
      }
    );
  },

  // 최근 메시지 불러오기
  async getRecentMessages(userId: string, personaId: string, limitCount: number = 30): Promise<Message[]> {
    const q = query(
      collection(db, 'chats', userId, 'personas', personaId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        sender: data.sender,
        text: data.text,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      };
    }).reverse();
  },

  // 이전 메시지 불러오기 (무한 스크롤)
  async getMoreMessages(userId: string, personaId: string, lastDoc: any, limitCount: number = 20): Promise<{ messages: Message[], lastDoc: any }> {
    const q = query(
      collection(db, 'chats', userId, 'personas', personaId, 'messages'),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        sender: data.sender,
        text: data.text,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      };
    }).reverse();
    
    return {
      messages,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || lastDoc
    };
  },

  // 실시간 메시지 구독
  subscribeToMessages(userId: string, personaId: string, callback: (messages: Message[]) => void) {
    const q = query(collection(db, 'chats', userId, 'personas', personaId, 'messages'), orderBy('createdAt'));
    return onSnapshot(q, (querySnapshot) => {
      const messages: Message[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          sender: data.sender,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      callback(messages);
    });
  }
};

// 프로필 관련 서비스
export const profileService = {
  // 프로필 데이터 가져오기
  async getProfile(userId: string): Promise<ProfileData | null> {
    const userRef = doc(db, 'users', userId);
    const profileRef = doc(userRef, 'profile', 'main');
    const snap = await getDoc(profileRef);
    
    if (snap.exists()) {
      return snap.data() as ProfileData;
    }
    return null;
  },

  // 프로필 데이터 저장
  async saveProfile(userId: string, profileData: Partial<ProfileData>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const profileRef = doc(userRef, 'profile', 'main');
    await setDoc(profileRef, profileData, { merge: true });
  },

  // 초기 프로필 생성
  async createInitialProfile(userId: string, email: string): Promise<void> {
    const defaultNick = email?.split('@')[0] || '사용자';
    await this.saveProfile(userId, { 
      nickname: defaultNick, 
      name: '세로',
      personaTags: ['유쾌함', '진지함'],
      expressionPrefs: [],
      tmtRatio: 50
    });
  }
};

// 관계도 관련 서비스
export const relationsService = {
  // 관계도 데이터 가져오기
  async getRelations(userId: string): Promise<RelationsData | null> {
    const relationsRef = doc(db, 'relations', userId, 'main', 'data');
    const snap = await getDoc(relationsRef);
    
    if (snap.exists()) {
      return snap.data() as RelationsData;
    }
    return null;
  },

  // 관계도 데이터 저장
  async saveRelations(userId: string, relationsData: RelationsData): Promise<void> {
    const relationsRef = doc(db, 'relations', userId, 'main', 'data');
    await setDoc(relationsRef, relationsData, { merge: true });
  },

  // 초기 관계도 생성
  async createInitialRelations(userId: string): Promise<void> {
    await this.saveRelations(userId, {
      userRelations: [{ name: "비어있음", type: "비어있음", desc: "비어있음", episodes: ["비어있음"] }],
      seroRelations: [{ name: "비어있음", relation: "비어있음", desc: "비어있음", episodes: ["비어있음"] }]
    });
  }
};

// 글로벌 설정 관련 서비스
export const globalService = {
  // 세로 지침 가져오기 (글로벌 설정에서)
  async getSeroGuideline(): Promise<string> {
    try {
      const settingsRef = doc(db, 'global', 'settings');
      const snap = await getDoc(settingsRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (data.guidelines && data.guidelines.seroGuideline) {
          return data.guidelines.seroGuideline;
        }
      }
      return ''; // 기본값
    } catch (error) {
      console.error('세로 지침 로드 실패:', error);
      return ''; // 기본값
    }
  },

  // 메시지 추출 임계값 가져오기 (글로벌 설정에서)
  async getMessageExtractThreshold(): Promise<number> {
    try {
      const settingsRef = doc(db, 'global', 'settings');
      const snap = await getDoc(settingsRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (data.system && typeof data.system.extractInterval === 'number' && data.system.extractInterval > 0) {
          return data.system.extractInterval;
        }
      }
      return 10; // 기본값 (글로벌 설정 기본값과 동일)
    } catch (error) {
      console.error('메시지 추출 임계값 로드 실패:', error);
      return 10; // 기본값
    }
  }
};

// 메타데이터 관련 서비스
export const metaService = {
  // 메타데이터 가져오기
  async getMeta(userId: string): Promise<UserMeta | null> {
    const metaRef = doc(db, 'users', userId, 'meta', 'main');
    const snap = await getDoc(metaRef);
    
    if (snap.exists()) {
      return snap.data() as UserMeta;
    }
    return null;
  },

  // 메타데이터 저장
  async saveMeta(userId: string, metaData: Partial<UserMeta>): Promise<void> {
    const metaRef = doc(db, 'users', userId, 'meta', 'main');
    await setDoc(metaRef, metaData, { merge: true });
  }
}; 

// 페르소나 관련 서비스
export const personaService = {
  // 페르소나 목록 가져오기
  async getPersonas(userId: string): Promise<PersonaListItem[]> {
    try {
      const personasRef = collection(db, 'personas', userId, 'items');
      const snapshot = await getDocs(personasRef);
      
      const personas: PersonaListItem[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        personas.push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastMessageAt: data.lastMessageAt?.toDate(),
          messageCount: data.messageCount || 0,
          tags: data.tags || [],
          characterProfile: data.characterProfile || { gender: '', job: '', description: '' }
        });
      }
      
      // 생성일 기준 내림차순 정렬
      return personas.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('페르소나 목록 로드 실패:', error);
      return [];
    }
  },

  // 페르소나 생성
  async createPersona(userId: string, personaData: CreatePersonaRequest): Promise<string> {
    try {
      // 중복 이름 확인
      const existingPersonas = await this.getPersonas(userId);
      let personaName = personaData.name;
      let counter = 1;
      
      while (existingPersonas.some(p => p.name === personaName)) {
        personaName = `${personaData.name}${counter}`;
        counter++;
      }

      const personaRef = doc(collection(db, 'personas', userId, 'items'));
      const now = new Date();
      
      await setDoc(personaRef, {
        name: personaName,
        tags: personaData.tags,
        expressionPrefs: personaData.expressionPrefs,
        tmtRatio: personaData.tmtRatio,
        characterProfile: personaData.characterProfile,
        createdAt: now,
        updatedAt: now,
        messageCount: 0
      });

      return personaRef.id;
    } catch (error) {
      console.error('페르소나 생성 실패:', error);
      throw error;
    }
  },

  // 페르소나 삭제
  async deletePersona(userId: string, personaId: string): Promise<void> {
    try {
      // 페르소나 삭제
      await deleteDoc(doc(db, 'personas', userId, 'items', personaId));
      
      // 관련 채팅 메시지 삭제
      const messagesRef = collection(db, 'chats', userId, 'personas', personaId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // 관련 관계도 삭제
      const relationsRef = doc(db, 'relations', userId, personaId, 'data');
      await deleteDoc(relationsRef);
      
    } catch (error) {
      console.error('페르소나 삭제 실패:', error);
      throw error;
    }
  },

  // 페르소나 정보 가져오기
  async getPersona(userId: string, personaId: string): Promise<Persona | null> {
    try {
      const personaRef = doc(db, 'personas', userId, 'items', personaId);
      const snapshot = await getDoc(personaRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          id: snapshot.id,
          name: data.name,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          tags: data.tags || [],
          characterProfile: {
            gender: data.characterProfile?.gender || '',
            job: data.characterProfile?.job || '',
            description: data.characterProfile?.description || '',
            age: data.characterProfile?.age,
            schedule: data.characterProfile?.schedule,
            scheduleVariablePool: data.characterProfile?.scheduleVariablePool
          } as import('../types').CharacterProfile,
          expressionPrefs: data.expressionPrefs || [],
          tmtRatio: data.tmtRatio || 50
        };
      }
      return null;
    } catch (error) {
      console.error('페르소나 정보 로드 실패:', error);
      return null;
    }
  },

  // 기본 "세로" 페르소나 생성 (가입 시)
  async createDefaultPersona(userId: string): Promise<string> {
    const { GlobalSettingsService } = await import('../services/globalSettingsService');
    const settings = await GlobalSettingsService.getInstance().getSettings();
    
    // 기본 타입 설정에서 태그와 감정표현 추출
    const defaultTags: string[] = [];
    const defaultExpressions: string[] = [];
    
    Object.entries(settings.personality.defaultTypeSettings || {}).forEach(([categoryName, selectedItems]) => {
      const type = settings.personality.types.find((t: any) => t.categoryName === categoryName);
      if (type) {
        if (type.type === 'tag') {
          defaultTags.push(...(selectedItems as string[]));
        } else if (type.type === 'example') {
          defaultExpressions.push(...(selectedItems as string[]));
        }
      }
    });

    const defaultPersonaData: CreatePersonaRequest = {
      name: '세로',
      tags: defaultTags,
      expressionPrefs: defaultExpressions,
      tmtRatio: settings.system.tmtRatio,
      characterProfile: {
        gender: '',
        job: '',
        description: ''
      }
    };

    return this.createPersona(userId, defaultPersonaData);
  },

  // 페르소나 스케줄/변수Pool 저장
  async setPersonaScheduleAndPool(userId: string, personaId: string, pool: ScheduleVariable[], schedule: CharacterSchedule) {
    const personaRef = doc(db, 'personas', userId, 'items', personaId);
    await updateDoc(personaRef, {
      'characterProfile.scheduleVariablePool': pool,
      'characterProfile.schedule': schedule
    });
  },

  // 페르소나 스케줄/변수Pool 불러오기
  async getPersonaScheduleAndPool(userId: string, personaId: string): Promise<{ pool: ScheduleVariable[]; schedule: CharacterSchedule | null }> {
    const personaRef = doc(db, 'personas', userId, 'items', personaId);
    const snap = await getDoc(personaRef);
    if (snap.exists()) {
      const data = snap.data();
      const pool = data.characterProfile?.scheduleVariablePool || [];
      const schedule = data.characterProfile?.schedule || null;
      return { pool, schedule };
    }
    return { pool: [], schedule: null };
  }
}; 