import { createContext, useContext, useState, useRef, useEffect } from 'react';
// @ts-ignore
import Peer from 'peerjs';
import { realtimeDb } from '../firebase/client';
import { ref, push, onValue, remove, set, onDisconnect } from 'firebase/database';
import { useAuth } from './AuthContext';

interface VideoContextType {
  isCalling: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  startCall: () => void;
  stopCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  peerId: string | null;
  isConnecting: boolean;
}

const VideoContext = createContext<VideoContextType | null>(null);

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isCalling, setIsCalling] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const peerRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const queueRef = useRef<any>(null);
  const matchListenerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inisialisasi PeerJS dengan server yang lebih stabil
  useEffect(() => {
    if (!user) {
      console.log('No user, skipping Peer init');
      return;
    }

    console.log('Initializing PeerJS for user:', user.uid);
    setIsConnecting(true);

    // Gunakan server peerjs yang lebih stabil atau custom
    const peer = new Peer(user.uid, {
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peerRef.current = peer;

    peer.on('open', (id: string) => {
      console.log('✅ PeerJS connected with ID:', id);
      setPeerId(id);
      setIsConnecting(false);
    });

    peer.on('error', (err: any) => {
      console.error('❌ PeerJS error:', err);
      setIsConnecting(false);
      if (err.type === 'unavailable-id' || err.type === 'invalid-id') {
        console.warn('⚠️ Peer ID already in use, retrying with different ID...');
        // Jika ID sudah digunakan, reconnect dengan ID baru
        peer.destroy();
        const newPeer = new Peer(undefined, {
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });
        peerRef.current = newPeer;
        // Re-bind event listeners
        newPeer.on('open', (id: string) => {
          console.log('✅ Reconnected with new ID:', id);
          setPeerId(id);
          setIsConnecting(false);
        });
        newPeer.on('call', handleIncomingCall);
        newPeer.on('error', (e: any) => console.error('Peer error:', e));
      }
    });

    peer.on('call', handleIncomingCall);

    // Request media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log('✅ Local media stream acquired');
        setLocalStream(stream);
        streamRef.current = stream;
      })
      .catch((err) => {
        console.error('❌ Failed to get media stream:', err);
        // Coba tanpa video jika error
        navigator.mediaDevices
          .getUserMedia({ video: false, audio: true })
          .then((stream) => {
            console.log('✅ Audio only stream acquired');
            setLocalStream(stream);
            streamRef.current = stream;
          })
          .catch((e) => {
            console.error('❌ Even audio failed:', e);
          });
      });

    // Cleanup
    return () => {
      console.log('Cleaning up PeerJS...');
      if (matchListenerRef.current) {
        matchListenerRef.current();
        matchListenerRef.current = null;
      }
      if (queueRef.current) {
        remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
        queueRef.current = null;
      }
      if (callRef.current) {
        callRef.current.close();
        callRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      peer.disconnect();
      peer.destroy();
      peerRef.current = null;
    };
  }, [user]);

  const handleIncomingCall = (call: any) => {
    console.log('📞 Incoming call from:', call.peer);
    if (streamRef.current) {
      call.answer(streamRef.current);
      call.on('stream', (remoteStream: MediaStream) => {
        console.log('✅ Remote stream received');
        setRemoteStream(remoteStream);
        setIsCalling(true);
      });
      callRef.current = call;
    } else {
      console.warn('⚠️ No local stream to answer call');
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => (track.enabled = !track.enabled));
      setMicOn((prev) => !prev);
      console.log('🎤 Mic toggled to:', !micOn);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => (track.enabled = !track.enabled));
      setCamOn((prev) => !prev);
      console.log('📷 Cam toggled to:', !camOn);
    }
  };

  const startCall = async () => {
    if (!user || !peerRef.current) {
      console.warn('⚠️ No user or peer');
      return;
    }
    if (!peerId) {
      console.warn('⚠️ Peer not ready');
      alert('Menunggu koneksi PeerJS, coba lagi nanti.');
      return;
    }
    if (!streamRef.current) {
      console.warn('⚠️ No local stream');
      alert('Tidak ada akses ke kamera/mikrofon.');
      return;
    }

    console.log('🚀 Starting call...');

    // Cek apakah sudah di antrian
    if (queueRef.current) {
      console.warn('⚠️ Already in queue');
      return;
    }

    try {
      setIsConnecting(true);

      // Masukkan ke antrian
      const queueRefDb = ref(realtimeDb, 'queue');
      const newQueueRef = push(queueRefDb);
      await set(newQueueRef, {
        uid: user.uid,
        peerId: peerId,
        timestamp: Date.now(),
      });
      queueRef.current = { ref: queueRefDb, key: newQueueRef.key };
      console.log('📝 Added to queue');

      // Hapus dari antrian jika koneksi putus
      onDisconnect(newQueueRef).remove();

      // Dengarkan kecocokan
      const matchRef = ref(realtimeDb, 'matches');
      matchListenerRef.current = onValue(matchRef, (snapshot) => {
        const matches = snapshot.val();
        if (!matches) {
          console.log('No matches yet');
          return;
        }

        console.log('🔍 Checking matches:', matches);

        for (const key in matches) {
          const match = matches[key];

          // Jika user ini adalah user1 dan ada user2
          if (match.user1 === user.uid && match.user2) {
            console.log('✅ Match found as user1! Partner:', match.user2);
            const partnerId = match.peerId2 || match.user2;

            // Hapus match dari database
            remove(ref(realtimeDb, `matches/${key}`)).then(() => {
              console.log('🗑️ Match removed');
            });

            // Panggil partner
            if (streamRef.current && peerRef.current) {
              console.log('📞 Calling partner:', partnerId);
              const call = peerRef.current.call(partnerId, streamRef.current);
              if (call) {
                callRef.current = call;
                call.on('stream', (remoteStream: MediaStream) => {
                  console.log('✅ Remote stream connected!');
                  setRemoteStream(remoteStream);
                  setIsCalling(true);
                  setIsConnecting(false);
                });
                call.on('error', (err: any) => {
                  console.error('❌ Call error:', err);
                  setIsConnecting(false);
                  alert('Gagal terhubung dengan partner.');
                });
              }
            }
            // Hapus dari antrian
            if (queueRef.current) {
              remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
              queueRef.current = null;
            }
            break;
          }

          // Jika user ini adalah user2 (ditemukan oleh match)
          if (match.user2 === user.uid && match.user1) {
            console.log('✅ Match found as user2! Partner:', match.user1);
            // Hapus match
            remove(ref(realtimeDb, `matches/${key}`)).then(() => {
              console.log('🗑️ Match removed');
            });
            // Hapus dari antrian
            if (queueRef.current) {
              remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
              queueRef.current = null;
            }
            setIsConnecting(false);
            // Panggilan akan masuk melalui peer.on('call')
            break;
          }
        }
      });

      // Timeout jika tidak ada match
      setTimeout(() => {
        if (!isCalling && queueRef.current) {
          console.log('⏰ Match timeout, removing from queue');
          remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
          queueRef.current = null;
          setIsConnecting(false);
          alert('Tidak ditemukan partner. Silakan coba lagi.');
        }
      }, 30000); // 30 detik timeout

    } catch (error) {
      console.error('❌ Error starting call:', error);
      setIsConnecting(false);
      alert('Terjadi kesalahan: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const stopCall = () => {
    console.log('🛑 Stopping call...');
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    setIsCalling(false);
    setIsConnecting(false);

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
        micOn,
        camOn,
        peerId,
        isConnecting,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};
