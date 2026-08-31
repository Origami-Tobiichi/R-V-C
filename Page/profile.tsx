import Profile from '../components/Profile';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Profile />
    </div>
  );
}
