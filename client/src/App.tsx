import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as faceapi from '@vladmandic/face-api';

const socket = io('http://localhost:3001');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const THEMES = [
  { id: 'white', name: 'Classic', hex: '#ffffff' },
  { id: 'cream', name: 'Cream', hex: '#fdfbf7' },
  { id: 'pink', name: 'Blush', hex: '#fdf2f8' },
  { id: 'blue', name: 'Sky', hex: '#f0f9ff' },
  { id: 'black', name: 'Midnight', hex: '#111827', textColor: '#ffffff' },
];

const FILTERS = [
  { id: 'none', name: 'Original', css: 'none', canvasFilter: 'none' },
  { id: 'mono', name: 'B&W', css: 'grayscale(100%) contrast(120%)', canvasFilter: 'grayscale(100%) contrast(120%)' },
  { id: 'retro', name: 'Retro', css: 'sepia(40%) contrast(110%) brightness(110%) saturate(130%)', canvasFilter: 'sepia(40%) contrast(110%) brightness(110%) saturate(130%)' },
];

const POSES = [
  { emoji: '😁', expression: 'happy', label: 'Smile!' },
  { emoji: '😲', expression: 'surprised', label: 'Surprised!' },
  { emoji: '😐', expression: 'neutral', label: 'Serious.' },
  { emoji: '😡', expression: 'angry', label: 'Angry!' },
  { emoji: '😢', expression: 'sad', label: 'Sad.' },
  { emoji: '😱', expression: 'fearful', label: 'Scared!' },
  { emoji: '🤢', expression: 'disgusted', label: 'Eww!' }
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', 
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', 
  '#57534e', '#000000', '#ffffff'
];

const STICKERS = ['✨', '💖', '🔥', '🎀', '👑', '✌️', '👽', '🤠', '🍒', '🦋', '⭐', '💋'];

function App() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(new URLSearchParams(window.location.search).get('room'));
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [photoStrip, setPhotoStrip] = useState<string[]>([]);
  const [activeTheme, setActiveTheme] = useState(THEMES[0]);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [targetPose, setTargetPose] = useState<typeof POSES[0] | null>(null);
  const [isAiMode, setIsAiMode] = useState(true);

  const [editTool, setEditTool] = useState<'draw' | 'sticker'>('draw');
  const [brushColor, setBrushColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(12);
  const [activeSticker, setActiveSticker] = useState(STICKERS[0]);
  
  const [stickerSize, setStickerSize] = useState(80); 
  // --- NEW: Sticker Rotation State ---
  const [stickerRotation, setStickerRotation] = useState(0); 

  const undoStack = useRef<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load AI models:", err);
      }
    };
    loadModels();
  }, []);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    setRoomId(newRoomId);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      const cleanCode = joinCode.trim().toLowerCase();
      window.history.pushState({}, '', `?room=${cleanCode}`);
      setRoomId(cleanCode);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied! Send it to your partner.");
  };

  const handleThemeChange = (theme: typeof THEMES[0]) => {
    setActiveTheme(theme);
    if (roomId) socket.emit('theme-change', { roomId, theme });
  };

  const handleFilterChange = (filter: typeof FILTERS[0]) => {
    setActiveFilter(filter);
    if (roomId) socket.emit('filter-change', { roomId, filter });
  };

  const handleAiToggle = () => {
    const newState = !isAiMode;
    setIsAiMode(newState);
    if (roomId) socket.emit('toggle-ai', { roomId, isAiMode: newState });
  };

  const captureFrame = () => {
    if (!localVideoRef.current || !remoteVideoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 600;
    canvas.height = 400;
    ctx.filter = activeFilter.canvasFilter;

    ctx.save();
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(localVideoRef.current, 0, 0, 300, 400);
    ctx.restore();

    ctx.save();
    ctx.translate(600, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(remoteVideoRef.current, 0, 0, 300, 400);
    ctx.restore();

    ctx.filter = 'none';
    return canvas.toDataURL('image/png');
  };

  const waitForExpression = async (expectedExpression: string) => {
    return new Promise<void>((resolve) => {
      let timeoutId = setTimeout(() => { resolve(); }, 8000);
      const checkExpression = async () => {
        if (!localVideoRef.current) return;
        const detection = await faceapi
          .detectSingleFace(localVideoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detection) {
          const expressions = detection.expressions as unknown as Record<string, number>;
          const score = expressions[expectedExpression];
          if (score && score > 0.7) {
            clearTimeout(timeoutId);
            return resolve();
          }
        }
        if (!isAiMode) {
           clearTimeout(timeoutId);
           return resolve();
        }
        setTimeout(checkExpression, 200);
      };
      checkExpression();
    });
  };

  const startShootingSequence = async () => {
    setIsShooting(true);
    setPhotoStrip([]); 
    
    if (editorCanvasRef.current) {
        const ctx = editorCanvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, editorCanvasRef.current.width, editorCanvasRef.current.height);
        undoStack.current = [];
    }

    const shuffledPoses = [...POSES].sort(() => 0.5 - Math.random());
    const selectedPoses = shuffledPoses.slice(0, 4);

    const newStrip: string[] = [];
    
    for (let i = 0; i < 4; i++) {
      if (isAiMode) {
        const pose = selectedPoses[i];
        setTargetPose(pose);
        await waitForExpression(pose.expression);
        setTargetPose(null);
        setCountdown(1);
        await new Promise(r => setTimeout(r, 800));
        setCountdown(null);
      } else {
        for (let c = 3; c > 0; c--) {
          setCountdown(c);
          await new Promise(r => setTimeout(r, 1000));
        }
        setCountdown(null);
      }
      
      const imgData = captureFrame();
      if (imgData) newStrip.push(imgData);
      setPhotoStrip([...newStrip]); 
      
      await new Promise(r => setTimeout(r, 1000));
    }
    setIsShooting(false);
  };

  const handleStartClick = () => {
    socket.emit('start-photoshoot', roomId); 
    startShootingSequence(); 
  };

  const saveState = () => {
    const canvas = editorCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      if (undoStack.current.length > 20) undoStack.current.shift();
      undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  };

  const handleUndo = () => {
    const canvas = editorCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && undoStack.current.length > 0) {
      const lastState = undoStack.current.pop();
      if (lastState) ctx.putImageData(lastState, 0, 0);
    } else if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClear = () => {
    const canvas = editorCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      saveState();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const canvas = editorCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!coords || !ctx || !canvas) return;

    saveState();

    if (editTool === 'draw') {
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    } else if (editTool === 'sticker') {
      // --- NEW: Sticker Transform Logic ---
      ctx.save(); // Save the clean canvas grid state
      ctx.translate(coords.x, coords.y); // Move the "center" of the canvas to the mouse click
      ctx.rotate((stickerRotation * Math.PI) / 180); // Rotate the canvas based on the slider
      
      ctx.font = `${stickerSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw the sticker exactly at the new center (0,0)
      ctx.fillText(activeSticker, 0, 0); 
      
      ctx.restore(); // Snap the canvas grid back to normal so we don't break drawing!
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editTool !== 'draw') return;
    const coords = getCanvasCoords(e);
    const ctx = editorCanvasRef.current?.getContext('2d');
    if (!coords || !ctx) return;
    
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleDownload = async () => {
    if (photoStrip.length === 0) return;
    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    const imgWidth = 600;
    const imgHeight = 400;
    const padding = 40;
    const gap = 20;
    const bottomTextSpace = 100;

    finalCanvas.width = 680; 
    finalCanvas.height = 1800; 

    ctx.fillStyle = activeTheme.hex; 
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    const images = await Promise.all(photoStrip.map(src => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    }));

    images.forEach((img, index) => {
      const yOffset = padding + (index * (imgHeight + gap));
      ctx.drawImage(img, padding, yOffset, imgWidth, imgHeight);
    });

    ctx.fillStyle = activeTheme.id === 'black' ? '#e5e7eb' : '#9ca3af'; 
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYNCBOOTH', finalCanvas.width / 2, finalCanvas.height - 45);

    if (editorCanvasRef.current) {
        ctx.drawImage(editorCanvasRef.current, 0, 0, finalCanvas.width, finalCanvas.height);
    }

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
          console.warn("Camera locked or denied.");
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

      socket.on('start-photoshoot', () => startShootingSequence());
      socket.on('room-full', () => { alert("This room is already full!"); window.location.href = '/'; });
      socket.on('theme-change', (theme) => setActiveTheme(theme));
      socket.on('filter-change', (filter) => setActiveFilter(filter));
      socket.on('toggle-ai', (mode) => setIsAiMode(mode));
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('partner-connected');
      socket.off('webrtc-signal');
      socket.off('start-photoshoot');
      socket.off('room-full');
      socket.off('theme-change');
      socket.off('filter-change');
      socket.off('toggle-ai');
    };
  }, [roomId, isAiMode]);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-6xl font-extrabold mb-4 text-indigo-600 tracking-tight">SyncBooth</h1>
        <p className="text-xl text-gray-500 mb-12 font-medium">Capture moments together, no matter where you are.</p>
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center w-full max-w-md">
          <button onClick={handleCreateRoom} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl py-4 rounded-full shadow-lg transition-transform transform hover:-translate-y-1">
            Create a New Room
          </button>
          <div className="flex items-center w-full my-8">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-gray-400 font-medium text-sm tracking-wider">OR</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>
          <form onSubmit={handleJoinRoom} className="w-full flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-full text-center text-lg font-mono tracking-widest text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
            <button type="submit" disabled={!joinCode.trim()} className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-full shadow-md transition-transform transform hover:-translate-y-1">
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 relative">
      <h1 className="text-4xl font-extrabold mb-2 text-indigo-600 tracking-tight">SyncBooth</h1>
      
      <div className="mb-8 flex items-center gap-4 bg-white p-2 pl-4 rounded-full shadow-sm border border-gray-200">
        <span className="text-sm text-gray-500 font-mono">Room: <span className="font-bold text-gray-800">{roomId}</span></span>
        <button onClick={copyLink} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-full transition-colors">
          Copy Invite Link
        </button>
        {isConnected ? (
           <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded border border-green-400 ml-2">Connected</span>
        ) : (
           <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded border border-red-400 ml-2">Disconnected</span>
        )}
        {modelsLoaded ? (
           <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded border border-purple-400 ml-2">AI Ready</span>
        ) : (
           <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded border border-yellow-400 ml-2 animate-pulse">Loading AI...</span>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full">
        <div className="flex flex-col md:flex-row justify-center gap-6 mb-8 relative">
          
          {targetPose && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-black/40 rounded-2xl backdrop-blur-sm animate-fade-in">
              <span className="text-white text-9xl drop-shadow-2xl animate-bounce">{targetPose.emoji}</span>
              <span className="text-white text-4xl font-black mt-4 drop-shadow-lg uppercase tracking-widest">{targetPose.label}</span>
            </div>
          )}

          {countdown !== null && !targetPose && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 rounded-full w-32 h-32 flex items-center justify-center shadow-2xl">
                 <span className="text-indigo-600 text-6xl font-black animate-pulse">{countdown}</span>
              </div>
            </div>
          )}

          <div className="relative w-full max-w-[400px] aspect-[3/4] bg-gray-900 rounded-2xl overflow-hidden shadow-inner border-4 border-gray-100">
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-all duration-300" style={{ filter: activeFilter.css }} />
            <div className="absolute bottom-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
              <span className="text-white text-sm font-medium">You</span>
            </div>
          </div>

          <div className={`relative w-full max-w-[400px] aspect-[3/4] rounded-2xl overflow-hidden shadow-inner border-4 border-gray-100 flex flex-col items-center justify-center gap-3 transition-colors ${partnerConnected ? 'bg-gray-900' : 'bg-gray-50 border-dashed border-gray-300'}`}>
            <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-all duration-300 ${partnerConnected ? 'opacity-100' : 'opacity-0'}`} style={{ filter: activeFilter.css }} />
            {!partnerConnected && (
              <>
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-gray-400 font-medium">Waiting for partner...</span>
              </>
            )}
             {partnerConnected && (
                <div className="absolute bottom-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
                  <span className="text-white text-sm font-medium">Partner</span>
                </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-8 relative">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Frame Color</span>
            <div className="flex gap-3">
              {THEMES.map(theme => (
                <button key={theme.id} onClick={() => handleThemeChange(theme)} className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${activeTheme.id === theme.id ? 'border-indigo-500 scale-110 ring-2 ring-indigo-200' : 'border-gray-200'}`} style={{ backgroundColor: theme.hex }} title={theme.name} />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
             <div className="flex items-center gap-3 bg-gray-50 px-5 py-2 rounded-full border border-gray-200">
               <span className="text-sm font-bold text-gray-600">AI Pose Mode</span>
               <button onClick={handleAiToggle} className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${isAiMode ? 'bg-purple-500' : 'bg-gray-300'}`}>
                 <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isAiMode ? 'translate-x-6' : 'translate-x-1'}`} />
               </button>
             </div>
            <button onClick={handleStartClick} disabled={isShooting || (isAiMode && !modelsLoaded)} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none text-white font-bold text-xl py-4 px-16 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0">
              {isShooting ? "Shooting..." : (isAiMode && !modelsLoaded) ? "Loading AI..." : "Start Photoshoot"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider text-right">Photo Filter</span>
            <div className="flex gap-2">
              {FILTERS.map(filter => (
                <button key={filter.id} onClick={() => handleFilterChange(filter)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeFilter.id === filter.id ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                  {filter.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {photoStrip.length > 0 && (
        <div className="mt-16 flex flex-col items-center animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Decorate & Download</h2>
          
          <div className="bg-white px-6 py-4 rounded-full shadow-lg border border-gray-100 mb-8 flex flex-col md:flex-row items-center gap-6 z-20 w-full max-w-4xl justify-between">
             <div className="flex bg-gray-100 p-1 rounded-full shrink-0">
               <button onClick={() => setEditTool('draw')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${editTool === 'draw' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Draw</button>
               <button onClick={() => setEditTool('sticker')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${editTool === 'sticker' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>Stickers</button>
             </div>

             <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

             {/* TOOL OPTIONS */}
             <div className="flex-1 flex justify-center w-full">
               {editTool === 'draw' ? (
                  <div className="flex items-center gap-4 w-full max-w-lg overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    <div className="flex gap-2 shrink-0">
                      {COLORS.map(color => (
                        <button key={color} onClick={() => setBrushColor(color)} className={`w-8 h-8 rounded-full border-2 transition-transform shrink-0 ${brushColor === color ? 'scale-125 border-gray-400' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="h-6 w-px bg-gray-200 mx-2 shrink-0"></div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Size</span>
                      <input type="range" min="2" max="40" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-20 accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>
               ) : (
                  <div className="flex items-center gap-4 w-full max-w-lg overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    <div className="flex gap-2 text-2xl shrink-0">
                      {STICKERS.map(emoji => (
                        <button key={emoji} onClick={() => setActiveSticker(emoji)} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-transform shrink-0 ${activeSticker === emoji ? 'bg-gray-200 scale-110' : 'hover:bg-gray-100'}`}>{emoji}</button>
                      ))}
                    </div>
                    <div className="h-6 w-px bg-gray-200 mx-2 shrink-0"></div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Size</span>
                      <input type="range" min="40" max="250" value={stickerSize} onChange={(e) => setStickerSize(parseInt(e.target.value))} className="w-20 accent-indigo-600 cursor-pointer" />
                    </div>
                    {/* NEW: Rotation Slider UI */}
                    <div className="flex flex-col gap-1 shrink-0 ml-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Tilt</span>
                      <input type="range" min="0" max="360" value={stickerRotation} onChange={(e) => setStickerRotation(parseInt(e.target.value))} className="w-20 accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>
               )}
             </div>

             <div className="flex gap-2 shrink-0">
               <button onClick={handleUndo} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors" title="Undo Last Action">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
               </button>
               <button onClick={handleClear} className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors" title="Clear Canvas">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
               </button>
             </div>
          </div>

          <div className="relative">
            <div className="p-4 pb-8 rounded-sm shadow-2xl flex flex-col gap-2 w-[400px] transition-colors pointer-events-none" style={{ backgroundColor: activeTheme.hex }}>
              {photoStrip.map((src, index) => (
                <img key={index} src={src} alt={`Frame ${index + 1}`} className="w-full rounded-sm" />
              ))}
              <div className="mt-4 text-center">
                 <p className="font-mono tracking-widest text-sm font-bold" style={{ color: activeTheme.id === 'black' ? '#e5e7eb' : '#9ca3af' }}>SYNCBOOTH</p>
              </div>
            </div>

            <canvas
              ref={editorCanvasRef}
              width={680}
              height={1800}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`absolute top-0 left-0 w-full h-full z-10 touch-none ${editTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
            />
          </div>

          <button onClick={handleDownload} className="mt-8 bg-gray-900 hover:bg-black text-white font-bold py-4 px-12 rounded-full shadow-xl transition-transform hover:-translate-y-1 mb-12 z-20">
            Download High-Res Strip
          </button>
        </div>
      )}
    </div>
  );
}

export default App;