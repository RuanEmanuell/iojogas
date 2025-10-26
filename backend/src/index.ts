import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { getRandomNumber } from './utils/getRandomNumber';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Express com TypeScript 🚀');
});

const rooms: Record<string, { id: string; userName: string; roomAdmin: boolean }[]> = {};
const availableGames = ["FiveLetters"];

io.on("connection", (socket) => {
  console.log("🔌 Usuário conectado:", socket.id);

  socket.on("createRoom", (roomName: string, userName: string) => {
    socket.join(roomName);

    if (!rooms[roomName]) rooms[roomName] = [];

    rooms[roomName].push({
      id: socket.id,
      userName,
      roomAdmin: true
    });

    socket.emit("roomCreated", { roomName });
    console.log(`🟢 Sala criada: ${roomName} por ${userName}`);
  });

  socket.on("joinRoom", (roomName: string, userName: string) => {
    socket.join(roomName);

    if (!rooms[roomName]) rooms[roomName] = [];

    // 👉 evita duplicados
    const alreadyInRoom = rooms[roomName].some(p => p.id === socket.id);
    if (!alreadyInRoom) {
      rooms[roomName].push({
        id: socket.id,
        userName,
        roomAdmin: rooms[roomName].length === 0, // se for o primeiro, vira admin
      });
    }

    // 🔥 Envia pro novo jogador quem já tá na sala
    socket.emit("currentRoomPlayers", {
      players: rooms[roomName].map(p => ({
        id: p.id,
        userName: p.userName,
        roomAdmin: p.roomAdmin
      }))
    });

    // 🔔 Notifica os outros que entrou
    socket.to(roomName).emit("playerJoined", { userName });

    console.log(`👤 ${userName} entrou na sala ${roomName}`);
  });


  socket.on("startGame", (roomName: string) => {
    const currentGame = availableGames[getRandomNumber(0, availableGames.length - 1)];

    io.to(roomName).emit("gameStarted", {
      message: `O jogo da sala ${roomName} começou!`,
      game: currentGame,
    });

    console.log(`🎮 Jogo iniciado na sala ${roomName}: ${currentGame}`);
  });

  socket.on("disconnect", () => {
    for (const [roomName, players] of Object.entries(rooms)) {
      rooms[roomName] = players.filter(p => p.id !== socket.id);
      if (rooms[roomName].length === 0) {
        delete rooms[roomName];
        console.log(`❌ Sala ${roomName} removida (vazia)`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
