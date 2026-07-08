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

  // Listen for a user trying to join a specific room
  socket.on('join-room', (roomId) => {
    // Check how many people are currently in this room
    const room = io.sockets.adapter.rooms.get(roomId);
    const numClients = room ? room.size : 0;

    if (numClients === 0) {
      // First person to join -> create the room
      socket.join(roomId);
      socket.emit('room-created', roomId);
      console.log(`User ${socket.id} created room ${roomId}`);
    } else if (numClients === 1) {
      // Second person to join -> join the room
      socket.join(roomId);
      socket.emit('room-joined', roomId);
      
      // Tell the first person that their partner has arrived!
      socket.to(roomId).emit('partner-connected', socket.id);
      console.log(`User ${socket.id} joined room ${roomId}`);
    } else {
      // Third person -> reject them
      socket.emit('room-full', roomId);
      console.log(`User ${socket.id} rejected from full room ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});