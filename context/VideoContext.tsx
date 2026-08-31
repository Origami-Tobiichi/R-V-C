import { createContext, useContext, useState, useRef, useEffect } from 'react';
// @ts-ignore
import Peer from 'peerjs';
import { realtimeDb } from '../firebase/client';
import { ref, push, onValue, remove, set } from 'firebase/database';
import { useAuth } from './AuthContext';

interface VideoContextType {
  isCalling: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  startCall: () => void;
  stopCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const VideoContext = createContext<VideoContextType | null>(null);

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isCalling, setIsCalling] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const queueRef = useRef<any>(null);
  const matchListenerRef = useRef<any>(null);

  // Inisialisasi PeerJS dan ambil media lokal
  useEffect(() => {
    if (!user) return;

    const initPeer = () => {
      try {
        const peer = new Peer(user.uid, {
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
          debug: 2,
        });
        peerRef.current = peer;

        peer.on('open', (id: string) => {
          console.log('✅ PeerJS connected with ID:', id);
        });

        peer.on('error', (err: any) => {
          console.error('❌ PeerJS error:', err);
          if (err.type === 'unavailable-id' || err.type === 'disconnected') {
            alert('Koneksi PeerJS gagal. Silakan refresh halaman.');
          }
        });

        // Menangani panggilan masuk dari partner
        peer.on('call', (call: any) => {
          if (localStream) {
            call.answer(localStream);
            call.on('stream', (remoteStream: MediaStream) => {
              setRemoteStream(remoteStream);
              setIsCalling(true);
            });
            callRef.current = call;
          } else {
            console.warn('localStream not ready yet');
          }
        });

        return peer;
      } catch (err) {
        console.error('Failed to create Peer:', err);
        alert('Gagal inisialisasi video. Pastikan izin kamera/mikrofon diberikan.');
        return null;
      }
    };

    // Ambil akses kamera & mikrofon
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch((err) => {
        console.error('Media error:', err);
        alert('Izin kamera/mikrofon diperlukan untuk video call.');
      });

    const peer = initPeer();
    if (peer) peerRef.current = peer;

    return () => {
      if (peerRef.current) {
        peerRef.current.disconnect();
        peerRef.current.destroy();
      }
    };
  }, [user]);

  // Fungsi toggle mikrofon
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
    }
  };

  // Fungsi toggle kamera
  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => (track.enabled = !track.enabled));
    }
  };

  // Mulai panggilan (cari partner)
  const startCall = async () => {
    if (!user) {
      alert('Silakan login terlebih dahulu.');
      return;
    }
    if (!peerRef.current) {
      alert('PeerJS belum siap, tunggu sebentar.');
      return;
    }
    if (!localStream) {
      alert('Kamera/mikrofon belum diaktifkan.');
      return;
    }

    try {
      // Masukkan user ke antrian
      const queueRefDb = ref(realtimeDb, 'queue');
      const newQueueRef = push(queueRefDb);
      await set(newQueueRef, { uid: user.uid, timestamp: Date.now() });

      // Dengarkan kecocokan di node 'matches'
      const matchRef = ref(realtimeDb, 'matches');
      matchListenerRef.current = onValue(matchRef, (snapshot) => {
        const matches = snapshot.val();
        if (!matches) return;

        for (const key in matches) {
          const match = matches[key];
          // Jika user adalah user1 dan user2 sudah ada -> panggil user2
          if (match.user1 === user.uid && match.user2) {
            const partnerId = match.user2;
            remove(ref(realtimeDb, `matches/${key}`)); // hapus match setelah digunakan
            if (localStream) {
              const call = peerRef.current.call(partnerId, localStream);
              if (call) {
                callRef.current = call;
                call.on('stream', (remoteStream: MediaStream) => {
                  setRemoteStream(remoteStream);
                  setIsCalling(true);
                });
              }
            }
            break;
          }
          // Jika user adalah user2 dan user1 sudah ada -> tunggu dipanggil (ditangani oleh peer.on('call'))
          else if (match.user2 === user.uid && match.user1) {
            remove(ref(realtimeDb, `matches/${key}`));
            // Panggilan masuk akan ditangani oleh event listener 'call' di atas
            break;
          }
        }
      });

      queueRef.current = { ref: queueRefDb, key: newQueueRef.key };
    } catch (error) {
      console.error('Start call error:', error);
      alert('Gagal memulai panggilan. Coba lagi.');
    }
  };

  // Hentikan panggilan
  const stopCall = () => {
    // Tutup panggilan jika ada
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    // Hentikan remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setIsCalling(false);

    // Hapus dari antrian jika masih ada
    if (queueRef.current) {
      remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
      queueRef.current = null;
    }

    // Hentikan listener match
    if (matchListenerRef.current) {
      matchListenerRef.current();
      matchListenerRef.current = null;
    }
  };

  return (
    <VideoContext.Provider
      value={{
        isCalling,
        toggleMic,
        toggleCam,
        startCall,
        stopCall,
        localStream,
        remoteStream,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => useContext(VideoContext)!;
