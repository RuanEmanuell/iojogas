import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Express com TypeScript 🚀');
});

const rooms: Record<string, { id: string; userName: string }[]> = {};

io.on("connection", (socket) => {
  console.log("🔌 Usuário conectado:", socket.id);

  socket.on("createRoom", (roomName, userName) => {
    socket.join(roomName);

    const clients = Array.from(io.sockets.adapter.rooms.get(roomName) || []).map(id =>
      id === socket.id ? userName : id
    );

    socket.emit("roomCreated", { roomName });
    socket.emit("currentPlayers", clients);
  });


  socket.on("joinRoom", (roomName, userName) => {
    socket.join(roomName);

    if (!rooms[roomName]) rooms[roomName] = [];
    rooms[roomName].push({ id: socket.id, userName });

    socket.emit(
      "currentPlayers",
      rooms[roomName].map((p) => p.userName)
    );

    socket.to(roomName).emit("playerJoined", { userName });
  });
});


server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
