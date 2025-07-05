import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const initAdmin = async () => {
  try {
    await setDoc(doc(db, 'admins', 'admin@sero.com'), {
      role: 1,
      name: '최초 관리자'
    });
    console.log('admin@sero.com 계정이 1등급 어드민으로 등록되었습니다.');
    return true;
  } catch (error) {
    console.error('어드민 등록 실패:', error);
    return false;
  }
}; 