import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/client';

export default function Navbar() {
  const { user, isAdmin } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center flex-wrap">
      <Link href="/" className="text-xl font-bold text-blue-600">📹 RandomCall</Link>
      <div className="flex gap-4 items-center flex-wrap">
        {user ? (
          <>
            <Link href="/profile" className="text-gray-700 hover:text-blue-600">Profil</Link>
            {isAdmin && (
              <Link href="/admin" className="text-gray-700 hover:text-blue-600">Admin</Link>
            )}
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-gray-700 hover:text-blue-600">Login</Link>
            <Link href="/register" className="text-gray-700 hover:text-blue-600">Registrasi</Link>
          </>
        )}
      </div>
    </nav>
  );
}
