import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// Free STUN servers provided by Google to help browsers find each other
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

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(new URLSearchParams(window.location.search).get('room'));
  const [partnerConnected, setPartnerConnected] = useState(false);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    setRoomId(newRoomId);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied! Send it to your partner.");
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

   if (roomId) {
      // 1. Initialize logic
      const initRoom = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        } catch (err) {
          console.warn("Camera locked by another tab, or permissions denied.");
        } finally {
          // 2. ALWAYS join the room, even if the camera failed
          socket.emit('join-room', roomId);
        }
      };

      initRoom();

      // --- WebRTC Logic ---

      // Helper function to create the WebRTC connection
      const createPeerConnection = () => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // When we get network candidates, send them to the partner
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc-signal', { roomId, signal: { type: 'candidate', candidate: event.candidate } });
          }
        };

        // When we receive the partner's video stream, attach it to the remote video element
        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setPartnerConnected(true);
          }
        };

        // Add our local video track to the connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }

        return pc;
      };

      // The FIRST person in the room gets this event when the second person joins
      socket.on('partner-connected', async () => {
        setPartnerConnected(true);
        peerConnectionRef.current = createPeerConnection();
        
        // Create an "Offer" to connect and send it
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit('webrtc-signal', { roomId, signal: offer });
      });

      // Handle incoming WebRTC signals (Offers, Answers, and Candidates)
      socket.on('webrtc-signal', async (signal) => {
        if (!peerConnectionRef.current) {
          peerConnectionRef.current = createPeerConnection();
        }

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

      <div className="mb-4">
        {isConnected ? (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded border border-green-400">Server Connected</span>
        ) : (
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-400">Disconnected</span>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Local User */}
          <div className="relative w-[300px] h-[400px] bg-gray-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
              <span className="text-white text-sm font-medium">You</span>
            </div>
          </div>

          {/* Remote User */}
          <div className={`relative w-[300px] h-[400px] rounded-xl overflow-hidden shadow-inner flex flex-col items-center justify-center gap-3 transition-colors ${partnerConnected ? 'bg-gray-900' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
            
            {/* The partner's video element */}
            <video ref={remoteVideoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${partnerConnected ? 'opacity-100' : 'opacity-0'}`} />
            
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
          <button className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none text-white font-bold text-lg py-4 px-12 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
            disabled={!partnerConnected}>
            Start Photoshoot
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;