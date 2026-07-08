import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Check the URL to see if we are already in a room (e.g., ?room=123)
  const [roomId, setRoomId] = useState(new URLSearchParams(window.location.search).get('room'));
  const [partnerConnected, setPartnerConnected] = useState(false);

  // Function to create a new room link
  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9); // Generates a random 7-character string
    window.history.pushState({}, '', `?room=${newRoomId}`); // Updates the URL without reloading the page
    setRoomId(newRoomId);
  };

  // Function to copy the link to the clipboard
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied! Send it to your partner.");
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // If we have a roomId, tell the server we want to join it
    if (roomId) {
      socket.emit('join-room', roomId);

      // Listen for the server telling us our partner joined
      socket.on('partner-connected', (partnerId) => {
        console.log("Partner joined with ID:", partnerId);
        setPartnerConnected(true);
      });

      // Handle full room error
      socket.on('room-full', () => {
        alert("This room is already full!");
        window.location.href = '/';
      });

      // Start the camera
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
        }
      };
      startCamera();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('partner-connected');
      socket.off('room-full');
    };
  }, [roomId]);

  // === VIEW 1: The Landing Page (If no room ID is in the URL) ===
  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-6xl font-extrabold mb-4 text-indigo-600 tracking-tight">SyncBooth</h1>
        <p className="text-xl text-gray-500 mb-12 font-medium">Create a virtual room and take photos with friends, anywhere.</p>
        <button 
          onClick={handleCreateRoom}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl py-4 px-12 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl"
        >
          Create a Room
        </button>
      </div>
    );
  }

  // === VIEW 2: The Photobooth (If there IS a room ID in the URL) ===
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <h1 className="text-4xl font-extrabold mb-2 text-indigo-600 tracking-tight">SyncBooth</h1>
      
      {/* Room Link Sharing Banner */}
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
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
              <span className="text-white text-sm font-medium">You</span>
            </div>
          </div>

          {/* Remote User */}
          <div className={`relative w-[300px] h-[400px] rounded-xl overflow-hidden shadow-inner flex flex-col items-center justify-center gap-3 transition-colors ${partnerConnected ? 'bg-gray-900' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
            {partnerConnected ? (
               <span className="text-white font-medium">Partner connected! (Video coming soon)</span>
            ) : (
              <>
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-gray-500 font-medium text-sm">Waiting for partner...</span>
              </>
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