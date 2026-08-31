import { useEffect, useRef, useState } from 'react';
import { useVideo } from '../context/VideoContext';

export default function VideoCall() {
  const {
    localStream,
    remoteStream,
    isCalling,
    toggleMic,
    toggleCam,
    startCall,
    stopCall,
    preference,
    setPreference,
  } = useVideo();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleToggleMic = () => {
    toggleMic();
    setMicOn((prev) => !prev);
  };

  const handleToggleCam = () => {
    toggleCam();
    setCamOn((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Video Call Random</h1>

      {/* Preferensi gender */}
      <div className="mb-4 flex gap-4 items-center">
        <span className="font-medium">Cari:</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="preference"
            value="all"
            checked={preference === 'all'}
            onChange={() => setPreference('all')}
          />
          Semua
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="preference"
            value="opposite"
            checked={preference === 'opposite'}
            onChange={() => setPreference('opposite')}
          />
          Lawan Jenis
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="preference"
            value="same"
            checked={preference === 'same'}
            onChange={() => setPreference('same')}
          />
          Sejenis
        </label>
      </div>

      <div className="relative w-full max-w-4xl aspect-video bg-gray-800 rounded-lg overflow-hidden">
        {isCalling ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-1/4 aspect-video bg-gray-700 rounded-lg border-2 border-white object-cover"
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white text-xl">
            {localStream ? 'Tekan Next untuk mulai' : 'Memuat kamera...'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        <button
          onClick={handleToggleMic}
          className="bg-gray-200 p-3 rounded-full shadow hover:bg-gray-300 transition"
        >
          🎤 {micOn ? 'On' : 'Off'}
        </button>
        <button
          onClick={handleToggleCam}
          className="bg-gray-200 p-3 rounded-full shadow hover:bg-gray-300 transition"
        >
          📷 {camOn ? 'On' : 'Off'}
        </button>
        <button
          onClick={startCall}
          className="bg-green-500 text-white px-6 py-2 rounded-full shadow hover:bg-green-600 transition"
        >
          Next
        </button>
        <button
          onClick={stopCall}
          className="bg-red-500 text-white px-6 py-2 rounded-full shadow hover:bg-red-600 transition"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
