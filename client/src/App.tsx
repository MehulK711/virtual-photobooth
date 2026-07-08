import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function App() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(new URLSearchParams(window.location.search).get('room'));
  const [partnerConnected, setPartnerConnected] = useState(false);
  
  // --- New Photoshoot States ---
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [photoStrip, setPhotoStrip] = useState<string[]>([]);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    setRoomId(newRoomId);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied! Send it to your partner.");
  };

  // --- Capture Engine Logic ---
  const captureFrame = () => {
    if (!localVideoRef.current || !remoteVideoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 600;
    canvas.height = 400;

    // Draw Local (Mirrored to match screen)
    ctx.save();
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(localVideoRef.current, 0, 0, 300, 400);
    ctx.restore();

    // Draw Remote (Mirrored to match screen)
    ctx.save();
    ctx.translate(600, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(remoteVideoRef.current, 0, 0, 300, 400);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  const startShootingSequence = async () => {
    setIsShooting(true);
    setPhotoStrip([]); 
    
    const newStrip: string[] = [];
    
    // Loop 4 times for 4 photos
    for (let i = 0; i < 4; i++) {
      // 3-2-1 Countdown
      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null); 
      
      // Flash and capture!
      const imgData = captureFrame();
      if (imgData) newStrip.push(imgData);
      setPhotoStrip([...newStrip]); 
      
      // Pause for a second before starting the next photo countdown
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setIsShooting(false);
  };

  const handleStartClick = () => {
    socket.emit('start-photoshoot', roomId); // Tell partner to start
    startShootingSequence(); // Start locally
  };


// --- Export Engine Logic ---
  const handleDownload = async () => {
    if (photoStrip.length === 0) return;

    // Create an invisible canvas in memory to assemble the final strip
    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Dimensions to match a classic vertical photobooth strip
    const imgWidth = 600;
    const imgHeight = 400;
    const padding = 40;
    const gap = 20;
    const bottomTextSpace = 100;

    finalCanvas.width = imgWidth + (padding * 2);
    finalCanvas.height = (imgHeight * 4) + (gap * 3) + padding + bottomTextSpace;

    // Fill the background (Classic White)
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Convert base64 strings back into HTML Image objects
    const images = await Promise.all(photoStrip.map(src => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    }));

    // Draw each photo onto the master canvas
    images.forEach((img, index) => {
      const yOffset = padding + (index * (imgHeight + gap));
      ctx.drawImage(img, padding, yOffset, imgWidth, imgHeight);
    });

    // Add the branding text at the bottom
    ctx.fillStyle = '#9ca3af'; 
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '10px'; // Note: letterSpacing in canvas requires modern browser support
    ctx.fillText('SYNCBOOTH', finalCanvas.width / 2, finalCanvas.height - 45);

    // Trigger the download
    const link = document.createElement('a');
    link.download = `syncbooth-${Date.now()}.png`;
    link.href = finalCanvas.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    if (roomId) {
      const initRoom = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        } catch (err) {
          console.warn("Camera locked by another tab, or permissions denied.");
        } finally {
          socket.emit('join-room', roomId);
        }
      };

      initRoom();

      const createPeerConnection = () => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc-signal', { roomId, signal: { type: 'candidate', candidate: event.candidate } });
          }
        };
        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setPartnerConnected(true);
          }
        };
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }
        return pc;
      };

      socket.on('partner-connected', async () => {
        setPartnerConnected(true);
        peerConnectionRef.current = createPeerConnection();
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit('webrtc-signal', { roomId, signal: offer });
      });

      socket.on('webrtc-signal', async (signal) => {
        if (!peerConnectionRef.current) peerConnectionRef.current = createPeerConnection();

        if (signal.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit('webrtc-signal', { roomId, signal: answer });
        } else if (signal.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.type === 'candidate') {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      });

      // Listen for partner clicking start
      socket.on('start-photoshoot', () => {
        startShootingSequence();
      });

      socket.on('room-full', () => {
        alert("This room is already full!");
        window.location.href = '/';
      });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('partner-connected');
      socket.off('webrtc-signal');
      socket.off('start-photoshoot');
      socket.off('room-full');
    };
  }, [roomId]);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-6xl font-extrabold mb-4 text-indigo-600 tracking-tight">SyncBooth</h1>
        <p className="text-xl text-gray-500 mb-12 font-medium">Create a virtual room and take photos with friends, anywhere.</p>
        <button onClick={handleCreateRoom} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl py-4 px-12 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl">
          Create a Room
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <h1 className="text-4xl font-extrabold mb-2 text-indigo-600 tracking-tight">SyncBooth</h1>
      
      <div className="mb-8 flex items-center gap-4 bg-white p-2 pl-4 rounded-full shadow-sm border border-gray-200">
        <span className="text-sm text-gray-500 font-mono">Room: {roomId}</span>
        <button onClick={copyLink} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-full transition-colors">
          Copy Invite Link
        </button>
      </div>

      {/* Hidden Canvas used for merging photos */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100">
        <div className="relative flex flex-col md:flex-row gap-4">
          
          {/* Giant Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
              <span className="text-white text-9xl font-black drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] animate-pulse">
                {countdown}
              </span>
            </div>
          )}

          {/* Local User */}
          <div className="relative w-[300px] h-[400px] bg-gray-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
              <span className="text-white text-sm font-medium">You</span>
            </div>
          </div>

          {/* Remote User */}
          <div className={`relative w-[300px] h-[400px] rounded-xl overflow-hidden shadow-inner flex flex-col items-center justify-center gap-3 transition-colors ${partnerConnected ? 'bg-gray-900' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
            <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${partnerConnected ? 'opacity-100' : 'opacity-0'}`} />
            
            {!partnerConnected && (
              <>
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-gray-500 font-medium text-sm">Waiting for partner...</span>
              </>
            )}
             {partnerConnected && (
                <div className="absolute bottom-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
                  <span className="text-white text-sm font-medium">Partner</span>
                </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button 
            onClick={handleStartClick}
            disabled={isShooting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none text-white font-bold text-lg py-4 px-12 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
          >
            {isShooting ? "Smile!" : "Start Photoshoot"}
          </button>
        </div>
      </div>

      {/* Generated Photo Strip Area */}
      {photoStrip.length > 0 && (
        <div className="mt-12 flex flex-col items-center animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Photos</h2>
          
          {/* The Physical-Looking Strip */}
          <div className="bg-white p-4 pb-8 rounded-sm shadow-xl flex flex-col gap-2 w-[400px]">
            {photoStrip.map((src, index) => (
              <img key={index} src={src} alt={`Frame ${index + 1}`} className="w-full rounded-sm" />
            ))}
            <div className="mt-4 text-center">
               <p className="font-mono text-gray-400 tracking-widest text-sm">SYNCBOOTH</p>
            </div>
          </div>

          <button 
            onClick={handleDownload}
            className="mt-6 bg-gray-900 hover:bg-black text-white font-semibold py-3 px-8 rounded-full shadow-md transition-transform hover:-translate-y-1">
             Download Strip
          </button>
        </div>
      )}
    </div>
  );
}

export default App;