import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/client';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      router.push('/profile');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Email ini sudah terdaftar. Silakan login.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Format email tidak valid.');
      } else {
        setErrorMessage(error.message || 'Terjadi kesalahan saat registrasi');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Registrasi</h2>
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMessage}
          {errorMessage.includes('sudah terdaftar') && (
            <div className="mt-2">
              <Link href="/login" className="text-blue-600 underline">Login di sini</Link>
            </div>
          )}
        </div>
      )}
      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Nama"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 karakter)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
          required
          minLength={6}
        />
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition">
          Daftar
        </button>
      </form>
      <p className="mt-4 text-center">
        Sudah punya akun? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
      </p>
    </div>
  );
}
