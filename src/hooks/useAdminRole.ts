import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useAdminRole(user: { email?: string } | null) {
  const [role, setRole] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) {
      setRole(null);
      return;
    }
    setLoading(true);
    const checkAdmin = async () => {
      try {
        if (user.email) {
          const adminRef = doc(db, 'admins', user.email);
          const snap = await getDoc(adminRef);
          if (snap.exists()) {
            setRole(snap.data().role ?? null);
          } else {
            setRole(null);
          }
        } else {
          setRole(null);
        }
      } catch (e) {
        setRole(null);
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  return { role, loading };
} 