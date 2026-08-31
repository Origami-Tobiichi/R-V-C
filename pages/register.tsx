import Register from '../components/Register';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RegisterPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/profile'); // langsung ke profil untuk mengisi data
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Register />
    </div>
  );
}
