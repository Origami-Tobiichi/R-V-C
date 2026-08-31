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
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Perbaikan: gunakan any untuk peerRef
  const peerRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const queueRef = useRef<any>(null);
  const matchListenerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const peer = new Peer(user.uid, { debug: 2 });
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      console.log('My peer ID:', id);
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

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => setLocalStream(stream))
      .catch(console.error);

    return () => {
      peer.disconnect();
      peer.destroy();
    };
  }, [user, localStream]);

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => track.enabled = !track.enabled);
      setMicOn(prev => !prev);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => track.enabled = !track.enabled);
      setCamOn(prev => !prev);
    }
  };

  const startCall = async () => {
    if (!user || !peerRef.current) return;
    // Masukkan ke antrian
    const queueRefDb = ref(realtimeDb, 'queue');
    const newQueueRef = push(queueRefDb);
    await set(newQueueRef, { uid: user.uid, timestamp: Date.now() });

    // Dengarkan kecocokan
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
          // akan ditangani oleh peer.on('call')
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
