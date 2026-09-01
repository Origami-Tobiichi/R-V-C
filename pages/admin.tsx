import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { firestore, realtimeDb } from '../firebase/client';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import Navbar from '../components/Navbar';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Cek apakah user adalah admin (email tertentu)
  useEffect(() => {
    if (!loading && user) {
      // Ganti dengan email admin Anda
      if (user.email === 'admin@example.com') {
        setIsAdmin(true);
      } else {
        router.push('/');
      }
    }
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Ambil daftar user online dari Realtime Database
  useEffect(() => {
    if (!isAdmin) return;

    const onlineRef = ref(realtimeDb, 'online');
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const users = Object.keys(data).map((uid) => ({
          uid,
          ...data[uid],
        }));
        setOnlineUsers(users);
      } else {
        setOnlineUsers([]);
      }
      setLoadingData(false);
    });

    return () => off(onlineRef);
  }, [isAdmin]);

  // Ambil daftar user yang dibanned
  useEffect(() => {
    if (!isAdmin) return;
    const fetchBanned = async () => {
      try {
        const q = query(collection(firestore, 'users'), where('banned', '==', true));
        const snapshot = await getDocs(q);
        const banned = snapshot.docs.map(doc => doc.id);
        setBannedUsers(banned);
      } catch (error) {
        console.error('Error fetching banned users:', error);
      }
    };
    fetchBanned();
  }, [isAdmin]);

  const handleBan = async (uid: string) => {
    try {
      await updateDoc(doc(firestore, 'users', uid), { banned: true });
      setBannedUsers((prev) => [...prev, uid]);
      alert('User telah dibanned');
    } catch (error) {
      console.error('Error banning user:', error);
      alert('Gagal ban user');
    }
  };

  const handleUnban = async (uid: string) => {
    try {
      await updateDoc(doc(firestore, 'users', uid), { banned: false });
      setBannedUsers((prev) => prev.filter(id => id !== uid));
      alert('User telah di-unban');
    } catch (error) {
      console.error('Error unbanning user:', error);
      alert('Gagal unban user');
    }
  };

  if (loading || !isAdmin) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">User Online ({onlineUsers.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2">UID</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Gender</th>
                  <th className="p-2">Negara</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {onlineUsers.map((user) => (
                  <tr key={user.uid} className="border-t">
                    <td className="p-2">{user.uid.substring(0, 8)}...</td>
                    <td className="p-2">{user.email || '-'}</td>
                    <td className="p-2">{user.gender || '-'}</td>
                    <td className="p-2">{user.country || '-'}</td>
                    <td className="p-2">
                      {bannedUsers.includes(user.uid) ? (
                        <span className="text-red-600 font-semibold">Banned</span>
                      ) : (
                        <span className="text-green-600 font-semibold">Active</span>
                      )}
                    </td>
                    <td className="p-2">
                      {bannedUsers.includes(user.uid) ? (
                        <button
                          onClick={() => handleUnban(user.uid)}
                          className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(user.uid)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Ban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {onlineUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-gray-500">
                      Tidak ada user online
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
