import { useState, useEffect, useRef } from 'react';
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Refs untuk RecaptchaVerifier agar bisa digunakan ulang
  const recaptchaVerifierRef = useRef<any>(null);

  // Inisialisasi RecaptchaVerifier saat komponen mount
  useEffect(() => {
    // Pastikan elemen recaptcha-container ada
    const container = document.getElementById('recaptcha-container');
    if (!container) {
      console.warn('Element recaptcha-container not found, will be created later');
      return;
    }

    try {
      // Perbaikan: gunakan auth yang sudah diimpor
      const verifier = new RecaptchaVerifier(
        container,
        {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved, allow phone auth
            console.log('reCAPTCHA solved');
          },
        },
        auth
      );
      recaptchaVerifierRef.current = verifier;
      // Render reCAPTCHA
      verifier.render();
      console.log('✅ RecaptchaVerifier initialized');
    } catch (error) {
      console.error('❌ Failed to initialize RecaptchaVerifier:', error);
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        alert('Email tidak ditemukan. Silakan daftar terlebih dahulu.');
      } else if (error.code === 'auth/wrong-password') {
        alert('Password salah.');
      } else {
        alert(error.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phone || phone.length < 10) {
      alert('Masukkan nomor telepon yang valid (minimal 10 digit).');
      return;
    }

    // Pastikan format nomor internasional
    let phoneNumber = phone;
    if (!phone.startsWith('+')) {
      phoneNumber = '+62' + phone.replace(/^0+/, '');
    }

    try {
      setLoading(true);
      // Gunakan RecaptchaVerifier yang sudah diinisialisasi
      if (!recaptchaVerifierRef.current) {
        // Jika belum ada, buat baru
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          alert('Elemen reCAPTCHA tidak ditemukan. Refresh halaman.');
          setLoading(false);
          return;
        }
        const verifier = new RecaptchaVerifier(
          container,
          { size: 'invisible' },
          auth
        );
        recaptchaVerifierRef.current = verifier;
        await verifier.render();
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifierRef.current
      );
      setConfirmResult(confirmation);
      alert('Kode verifikasi dikirim ke ' + phoneNumber);
    } catch (error: any) {
      console.error('Phone auth error:', error);
      if (error.code === 'auth/invalid-phone-number') {
        alert('Nomor telepon tidak valid. Gunakan format internasional (contoh: +62812...).');
      } else if (error.code === 'auth/too-many-requests') {
        alert('Terlalu banyak percobaan. Coba lagi nanti.');
      } else {
        alert(error.message || 'Gagal mengirim kode verifikasi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      alert('Masukkan kode verifikasi 6 digit.');
      return;
    }
    try {
      setLoading(true);
      await confirmResult.confirm(verificationCode);
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/invalid-verification-code') {
        alert('Kode verifikasi salah. Coba lagi.');
      } else {
        alert(error.message);
      }
    } finally {
      setLoading(false);
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
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition">
          Login dengan Email
        </button>
      </form>

      <hr className="my-4" />

      <button onClick={handleGoogleLogin} className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition">
        Login dengan Google
      </button>

      <hr className="my-4" />

      <div className="space-y-2">
        <input
          type="tel"
          placeholder="Nomor Telepon (misal 8123456789 atau +62812...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={handlePhoneLogin}
          disabled={loading}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 transition disabled:opacity-50"
        >
          {loading ? 'Mengirim...' : 'Kirim Kode'}
        </button>

        {confirmResult && (
          <div className="mt-4">
            <input
              type="text"
              placeholder="Kode Verifikasi (6 digit)"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full p-2 border rounded"
              maxLength={6}
            />
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded mt-2 hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </div>
        )}
      </div>

      <div id="recaptcha-container" className="mt-4"></div>

      <p className="mt-4 text-center">
        Belum punya akun? <a href="/register" className="text-blue-600 hover:underline">Daftar</a>
      </p>
    </div>
  );
}
