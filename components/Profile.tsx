import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function Profile() {
  const { user } = useAuth();
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const docRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGender(data.gender || '');
          setAge(data.age || '');
          setCountry(data.country || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      alert('Silakan login terlebih dahulu.');
      return;
    }
    if (!gender) {
      alert('Pilih gender terlebih dahulu.');
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(firestore, 'users', user.uid);
      await setDoc(docRef, { gender, age, country }, { merge: true });
      alert('Profil berhasil disimpan!');
      router.push('/');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center mt-10">Memuat profil...</div>;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Profil</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Pilih</option>
            <option value="Pria">Pria</option>
            <option value="Wanita">Wanita</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Usia</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Masukkan usia"
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Negara</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Indonesia, USA, dll."
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
