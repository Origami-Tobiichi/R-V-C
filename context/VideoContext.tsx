import { createContext, useContext, useState, useRef, useEffect } from 'react';
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

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<any>(null);
  const queueRef = useRef<any>(null);

  // Initialize PeerJS
  useEffect(() => {
    if (!user) return;
    const peer = new Peer(user.uid, {
      debug: 2,
      // optional: custom host/port
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My peer ID is:', id);
    });

    peer.on('call', (call) => {
      // Answer incoming call
      if (localStream) {
        call.answer(localStream);
        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
          setIsCalling(true);
        });
        callRef.current = call;
      } else {
        // If no local stream yet, wait? Actually we should have local stream before starting.
      }
    });

    // Get local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch(console.error);

    return () => {
      peer.disconnect();
      peer.destroy();
    };
  }, [user]);

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
    // Add user to queue
    const queueRef = ref(realtimeDb, 'queue');
    const newQueueRef = push(queueRef);
    await set(newQueueRef, { uid: user.uid, timestamp: Date.now() });

    // Listen for match
    const matchRef = ref(realtimeDb, 'matches');
    const onMatch = onValue(matchRef, (snapshot) => {
      const matches = snapshot.val();
      if (!matches) return;
      // find match where this user is paired with someone else
      for (const key in matches) {
        const match = matches[key];
        if (match.user1 === user.uid && match.user2) {
          // found partner
          const partnerId = match.user2;
          // remove match from db
          remove(ref(realtimeDb, `matches/${key}`));
          // initiate call to partner
          if (localStream) {
            const call = peerRef.current?.call(partnerId, localStream);
            if (call) {
              callRef.current = call;
              call.on('stream', (remoteStream) => {
                setRemoteStream(remoteStream);
                setIsCalling(true);
              });
            }
          }
          break;
        } else if (match.user2 === user.uid && match.user1) {
          const partnerId = match.user1;
          // remove match
          remove(ref(realtimeDb, `matches/${key}`));
          // As the callee, the call will be received via peer.on('call') above.
          // But we need to ensure we have localStream ready.
          // We'll just set a flag.
          // The incoming call will be handled by peer.on('call') already.
        }
      }
    });

    // Cleanup listener after a while? We'll store to stop later.
    queueRef.current = { ref: queueRef, key: newQueueRef.key };
    // store match listener ref
    // We'll need to manage cleanup.
    // For simplicity, we store in a variable.
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
    // Also remove from queue if still there
    if (queueRef.current) {
      remove(ref(realtimeDb, `queue/${queueRef.current.key}`));
      queueRef.current = null;
    }
  };

  return (
    <VideoContext.Provider value={{ isCalling, toggleMic, toggleCam, startCall, stopCall, localStream, remoteStream }}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => useContext(VideoContext)!;
