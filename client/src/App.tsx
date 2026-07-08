import { useEffect, useRef } from 'react';

function App() {
  // We use a reference to directly manipulate the <video> HTML element
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Function to request camera access from the browser
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false, // Audio is off for now to prevent echo
        });
        
        // If the video element exists, attach the webcam stream to it
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        alert("Please allow camera access to use the photobooth!");
      }
    };

    startCamera();
  }, []); // The empty array ensures this only runs once when the app loads

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* App Header */}
      <h1 className="text-5xl font-extrabold mb-2 text-indigo-600 tracking-tight">SyncBooth</h1>
      <p className="text-gray-500 mb-8 font-medium">Capture moments, together.</p>

      {/* The Photobooth Frame */}
      <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Local User (You) */}
          <div className="relative w-[300px] h-[400px] bg-gray-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" // Mirrors the camera so it acts like a mirror
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
              <span className="text-white text-sm font-medium">You</span>
            </div>
          </div>

          {/* Remote User (Partner - Placeholder for now) */}
          <div className="relative w-[300px] h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-inner border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-gray-500 font-medium text-sm">Waiting for partner...</span>
          </div>
          
        </div>

        {/* Global Controls */}
        <div className="mt-8 flex justify-center">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg py-4 px-12 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0">
            Start Photoshoot
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;