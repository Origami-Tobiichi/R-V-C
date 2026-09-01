import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase/client';
import { onAuthStateChanged, User } from 'firebase/auth';
import { realtimeDb } from '../firebase/client';
import { ref, set, onDisconnect, remove } from 'firebase/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // Set online status di Realtime Database
        const userRef = ref(realtimeDb, `online/${user.uid}`);
        set(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          online: true,
          timestamp: Date.now()
        });
        // Hapus saat disconnect
        onDisconnect(userRef).remove();
      } else {
        // Hapus online status saat logout (opsional, karena onDisconnect sudah handle)
        // Tapi kita bisa hapus manual jika diperlukan
        if (auth.currentUser) {
          // Tidak perlu karena onDisconnect akan handle
        }
      }
    });

    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
