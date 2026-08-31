import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/AuthContext';
import { VideoProvider } from '../context/VideoContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <VideoProvider>
        <Component {...pageProps} />
      </VideoProvider>
    </AuthProvider>
  );
}

export default MyApp;
