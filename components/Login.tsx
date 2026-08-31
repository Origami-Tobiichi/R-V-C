import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { auth } from '../firebase/client';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Terjadi kesalahan saat login');
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Terjadi kesalahan saat login dengan Google');
      }
    }
  };

  const handlePhoneLogin = async () => {
    try {
      // Ambil container reCAPTCHA
      const container = document.getElementById('recaptcha-container');
      if (!container) {
        alert('Elemen reCAPTCHA tidak ditemukan');
        return;
      }

      // Inisialisasi RecaptchaVerifier dengan benar
      const recaptchaVerifier = new RecaptchaVerifier(
        container, // element
        { size: 'invisible' }, // parameter
        auth // auth instance
      );

      const confirmation = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
      setConfirmResult(confirmation);
      alert('Kode verifikasi dikirim!');
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Gagal mengirim kode verifikasi');
      }
    }
  };

  const handleVerifyCode = async () => {
    try {
      await confirmResult.confirm(verificationCode);
      router.push('/');
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Kode verifikasi salah');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Login</h2>
      <form onSubmit={handleEmailLogin} className="space-y-4">
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
          Login dengan Email
        </button>
      </form>
      <hr className="my-4" />
      <button onClick={handleGoogleLogin} className="w-full bg-red-500 text-white py-2 rounded">
        Login dengan Google
      </button>
      <hr className="my-4" />
      <div className="space-y-2">
        <input
          type="tel"
          placeholder="Nomor Telepon (misal +62812...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button onClick={handlePhoneLogin} className="w-full bg-green-500 text-white py-2 rounded">
          Kirim Kode
        </button>
        {confirmResult && (
          <div>
            <input
              type="text"
              placeholder="Kode Verifikasi"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <button onClick={handleVerifyCode} className="w-full bg-blue-600 text-white py-2 rounded mt-2">
              Verifikasi
            </button>
          </div>
        )}
      </div>
      <div id="recaptcha-container" className="mt-4"></div>
      <p className="mt-4 text-center">
        Belum punya akun? <a href="/register" className="text-blue-600">Daftar</a>
      </p>
    </div>
  );
}
