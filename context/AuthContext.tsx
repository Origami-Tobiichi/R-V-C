import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase/client';
import { onAuthStateChanged, User } from 'firebase/auth';
import { realtimeDb } from '../firebase/client';
import { ref, set, onDisconnect, remove } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // Cek apakah user adalah admin (email tertentu)
        const adminEmails = ['admin@example.com', 'admin@ryuzaki72.com']; // Ganti dengan email admin Anda
        setIsAdmin(adminEmails.includes(user.email || ''));

        // Set online status di Realtime Database
        const userRef = ref(realtimeDb, `online/${user.uid}`);
        // Ambil data user dari Firestore
        let userData: any = { uid: user.uid, email: user.email, displayName: user.displayName };
        try {
          const docRef = doc(firestore, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            userData = { ...userData, ...docSnap.data() };
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }

        await set(userRef, {
          ...userData,
          online: true,
          timestamp: Date.now()
        });
        onDisconnect(userRef).remove();
      } else {
        // Hapus online status saat logout
        if (auth.currentUser) {
          const userRef = ref(realtimeDb, `online/${auth.currentUser.uid}`);
          await remove(userRef);
        }
      }
    });

    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, loading, isAdmin }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
