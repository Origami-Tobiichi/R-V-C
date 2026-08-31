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
  const peerErrorCount = useRef(0);

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
          peerErrorCount.current = 0;
        });

        peer.on('error', (err: any) => {
          console.error('❌ PeerJS error:', err);
          if (err.type === 'unavailable-id' || err.type === 'disconnected') {
            peerErrorCount.current += 1;
            if (peerErrorCount.current <= 3) {
              alert('Koneksi PeerJS gagal, mencoba ulang...');
              setTimeout(() => {
                if (peerRef.current) {
                  peerRef.current.destroy();
                  initPeer();
                }
              }, 2000);
            } else {
              alert('Gagal terhubung ke server video. Silakan refresh halaman.');
            }
          }
        });

        peer.on('call', (call: any) => {
          if (localStream) {
            call.answer(localStream);
            call.on('stream', (remoteStream: MediaStream) => {
              setRemoteStream(remoteStream);
              setIsCalling(true);
            });
            callRef.current = call;
          }
        });

        return peer;
      } catch (err) {
        console.error('Failed to create Peer:', err);
        alert('Gagal inisialisasi video. Pastikan izin kamera/mikrofon diberikan.');
        return null;
      }
    };

    const peer = initPeer();
    if (peer) peerRef.current = peer;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => setLocalStream(stream))
      .catch((err) => {
        console.error('Media error:', err);
        alert('Izin kamera/mikrofon diperlukan untuk video call.');
      });

    return () => {
      if (peerRef.current) {
        peerRef.current.disconnect();
        peerRef.current.destroy();
      }
    };
  }, [user]);

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => track.enabled = !track.enabled);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => track.enabled = !track.enabled);
    }
  };

  const startCall = async () => {
    if (!user) {
      alert('Silakan login terlebih dahulu.');
      return;
    }
    if (!peerRef.current) {
      alert('PeerJS belum siap, tunggu beberapa saat.');
      return;
    }
    if (!localStream) {
      alert('Izin kamera/mikrofon belum diberikan.');
      return;
    }

    const queueRefDb = ref(realtimeDb, 'queue');
    const newQueueRef = push(queueRefDb);
    await set(newQueueRef, { uid: user.uid, timestamp: Date.now() });

    const matchRef = ref(realtimeDb, 'matches');
    matchListenerRef.current = onValue(matchRef, (snapshot) => {
      const matches = snapshot.val();
      if (!matches) return;
      for (const key in matches) {
        const match = matches[key];
        if (match.user1 === user.uid && match.user2) {
          const partnerId = match.user2;
          remove(ref(realtimeDb, `matches/${key}`));
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
        } else if (match.user2 === user.uid && match.user1) {
          remove(ref(realtimeDb, `matches/${key}`));
        }
      }
    });

    queueRef.current = { ref: queueRefDb, key: newQueueRef.key };
  };

  const stopCall = () => {
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    setIsCalling(false);
    if (queueRef.current) {
      remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
      queueRef.current = null;
    }
    if (matchListenerRef.current) {
      matchListenerRef.current();
      matchListenerRef.current = null;
    }
  };

  return (
    <VideoContext.Provider value={{ isCalling, toggleMic, toggleCam, startCall, stopCall, localStream, remoteStream }}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => useContext(VideoContext)!;
