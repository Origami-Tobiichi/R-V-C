import Login from '../components/Login';   // path harus relative ke pages
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const { user } = useAuth(); // perbaiki: gunakan useAuth, bukan useState
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Login />
    </div>
  );
}
