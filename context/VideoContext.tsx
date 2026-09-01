import { createContext, useContext, useState, useRef, useEffect } from 'react';
// @ts-ignore
import Peer from 'peerjs';
import { realtimeDb, firestore } from '../firebase/client';
import { ref, push, onValue, remove, set } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface VideoContextType {
  isCalling: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  startCall: () => void;
  stopCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  preference: string;
  setPreference: (val: string) => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isCalling, setIsCalling] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [preference, setPreference] = useState('all');

  const peerRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const queueRef = useRef<any>(null);
  const matchListenerRef = useRef<any>(null);

  // Cek apakah user dibanned
  const checkIfBanned = async (uid: string) => {
    try {
      const docRef = doc(firestore, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() && docSnap.data().banned === true;
    } catch (error) {
      console.error('Error checking ban:', error);
      return false;
    }
  };

  // Inisialisasi PeerJS dan media
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

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => setLocalStream(stream))
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

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => (track.enabled = !track.enabled));
    }
  };

  // Ambil data user dari Firestore
  const getUserData = async (uid: string) => {
    try {
      const docRef = doc(firestore, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Mulai panggilan
  const startCall = async () => {
    if (!user) {
      alert('Silakan login terlebih dahulu.');
      return;
    }

    // Cek apakah user dibanned
    const isBanned = await checkIfBanned(user.uid);
    if (isBanned) {
      alert('Akun Anda telah dibanned oleh admin.');
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

    // Ambil data gender user sendiri
    const userData = await getUserData(user.uid);
    const myGender = userData?.gender || '';

    if (!myGender) {
      alert('Silakan lengkapi profil (Gender) terlebih dahulu.');
      return;
    }

    try {
      // Masukkan ke antrian dengan gender
      const queueRefDb = ref(realtimeDb, 'queue');
      const newQueueRef = push(queueRefDb);
      await set(newQueueRef, {
        uid: user.uid,
        gender: myGender,
        timestamp: Date.now(),
      });

      // Dengarkan kecocokan
      const matchRef = ref(realtimeDb, 'matches');
      matchListenerRef.current = onValue(matchRef, async (snapshot) => {
        const matches = snapshot.val();
        if (!matches) return;

        for (const key in matches) {
          const match = matches[key];
          if (match.user1 === user.uid && match.user2) {
            const partnerId = match.user2;
            const partnerData = await getUserData(partnerId);
            const partnerGender = partnerData?.gender || '';

            let isMatch = false;
            if (preference === 'all') isMatch = true;
            else if (preference === 'opposite') isMatch = (myGender !== partnerGender);
            else if (preference === 'same') isMatch = (myGender === partnerGender);

            if (isMatch) {
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
            } else {
              remove(ref(realtimeDb, `matches/${key}`));
            }
          } else if (match.user2 === user.uid && match.user1) {
            const partnerId = match.user1;
            const partnerData = await getUserData(partnerId);
            const partnerGender = partnerData?.gender || '';

            let isMatch = false;
            if (preference === 'all') isMatch = true;
            else if (preference === 'opposite') isMatch = (myGender !== partnerGender);
            else if (preference === 'same') isMatch = (myGender === partnerGender);

            if (isMatch) {
              remove(ref(realtimeDb, `matches/${key}`));
            } else {
              remove(ref(realtimeDb, `matches/${key}`));
            }
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
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
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
    <VideoContext.Provider
      value={{
        isCalling,
        toggleMic,
        toggleCam,
        startCall,
        stopCall,
        localStream,
        remoteStream,
        preference,
        setPreference,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => useContext(VideoContext)!;
