const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const numClients = room ? room.size : 0;

    if (numClients === 0) {
      socket.join(roomId);
      socket.emit('room-created', roomId);
    } else if (numClients === 1) {
      socket.join(roomId);
      socket.emit('room-joined', roomId);
      // Tell the FIRST person to initiate the WebRTC call
      socket.to(roomId).emit('partner-connected'); 
    } else {
      socket.emit('room-full', roomId);
    }
  });

  // --- NEW: WebRTC Signaling Relay ---
  // When a user sends a WebRTC signal, forward it ONLY to the other person in the room
  socket.on('webrtc-signal', (data) => {
    socket.to(data.roomId).emit('webrtc-signal', data.signal);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});