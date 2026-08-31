import { useEffect, useRef } from 'react';
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
    micOn,
    camOn,
    peerId,
    isConnecting,
  } = useVideo();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Video Call Random</h1>

      {/* Status */}
      <div className="text-sm text-gray-500 mb-2">
        {peerId && <span>🟢 ID: {peerId.slice(0, 8)}... </span>}
        {isConnecting && <span>⏳ Menghubungkan...</span>}
        {!isCalling && !isConnecting && <span>💬 Tekan Next untuk mulai</span>}
        {isCalling && <span>📞 Sedang dalam panggilan</span>}
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
          <div className="flex flex-col items-center justify-center h-full text-white">
            <p className="text-xl">Tekan Next untuk mulai</p>
            {peerId && <p className="text-sm mt-2">ID: {peerId}</p>}
            {isConnecting && <p className="text-sm text-yellow-300">⏳ Mencari partner...</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full shadow ${
            micOn ? 'bg-gray-200' : 'bg-red-200'
          }`}
        >
          🎤 {micOn ? 'On' : 'Off'}
        </button>
        <button
          onClick={toggleCam}
          className={`p-3 rounded-full shadow ${
            camOn ? 'bg-gray-200' : 'bg-red-200'
          }`}
        >
          📷 {camOn ? 'On' : 'Off'}
        </button>
        <button
          onClick={startCall}
          disabled={isConnecting || isCalling}
          className="bg-green-500 text-white px-6 py-2 rounded-full shadow disabled:opacity-50"
        >
          {isConnecting ? '⏳...' : 'Next'}
        </button>
        <button
          onClick={stopCall}
          disabled={!isCalling && !isConnecting}
          className="bg-red-500 text-white px-6 py-2 rounded-full shadow disabled:opacity-50"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
