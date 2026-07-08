const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
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
      socket.to(roomId).emit('partner-connected'); 
    } else {
      socket.emit('room-full', roomId);
    }
  });

  socket.on('webrtc-signal', (data) => {
    socket.to(data.roomId).emit('webrtc-signal', data.signal);
  });

  socket.on('start-photoshoot', (roomId) => {
    socket.to(roomId).emit('start-photoshoot');
  });

  socket.on('theme-change', (data) => {
    socket.to(data.roomId).emit('theme-change', data.theme);
  });

  socket.on('filter-change', (data) => {
    socket.to(data.roomId).emit('filter-change', data.filter);
  });

  // --- NEW: Sync AI Mode Toggle ---
  socket.on('toggle-ai', (data) => {
    socket.to(data.roomId).emit('toggle-ai', data.isAiMode);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});