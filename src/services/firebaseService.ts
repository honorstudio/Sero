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
  startAfter 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Message, ProfileData, RelationsData, UserMeta } from '../types';

// 메시지 관련 서비스
export const messageService = {
  // 메시지 저장
  async saveMessage(userId: string, message: Message): Promise<void> {
    await addDoc(
      collection(db, 'chats', userId, 'messages'),
      {
        sender: message.sender,
        text: message.text,
        createdAt: serverTimestamp(),
      }
    );
  },

  // 최근 메시지 불러오기
  async getRecentMessages(userId: string, limitCount: number = 30): Promise<Message[]> {
    const q = query(
      collection(db, 'chats', userId, 'messages'),
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
  async getMoreMessages(userId: string, lastDoc: any, limitCount: number = 20): Promise<{ messages: Message[], lastDoc: any }> {
    const q = query(
      collection(db, 'chats', userId, 'messages'),
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
  subscribeToMessages(userId: string, callback: (messages: Message[]) => void) {
    const q = query(collection(db, 'chats', userId, 'messages'), orderBy('createdAt'));
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
  // 세로 지침 가져오기
  async getSeroGuideline(): Promise<string> {
    const guidelineRef = doc(db, 'global', 'sero_guideline');
    const snap = await getDoc(guidelineRef);
    
    if (snap.exists()) {
      return snap.data().guideline || '';
    }
    return '';
  },

  // 메시지 추출 임계값 가져오기
  async getMessageExtractThreshold(): Promise<number> {
    const countRef = doc(db, 'global', 'relation_count');
    const snap = await getDoc(countRef);
    
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.count === 'number' && data.count > 0) {
        return data.count;
      }
    }
    return 2; // 기본값
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