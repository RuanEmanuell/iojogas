import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { getRandomNumber } from './utils/getRandomNumber';
import { FiveLettersController } from './controllers/FiveLettersController';
import { Room } from './types/Room';
import { Player } from './types/Player';

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

const rooms: Room = {};
const availableGames = ["FiveLetters"];
const activeGameControllers: Record<string, FiveLettersController> = {};

function addPlayerToRoom(roomName: string, player: Player) {
  if (!rooms[roomName]) rooms[roomName] = [];
  const alreadyInRoom = rooms[roomName].some(p => p.id === player.id);
  if (!alreadyInRoom) rooms[roomName].push(player);
}

io.on("connection", (socket) => {
  console.log("🔌 Usuário conectado:", socket.id);

  socket.on("createRoom", (roomName: string, userName: string) => {
    if (!rooms[roomName]) rooms[roomName] = [];

    const player: Player = { id: socket.id, userName, roomAdmin: true };
    addPlayerToRoom(roomName, player);
    socket.join(roomName);

    socket.emit("roomCreated", { roomName }, () => {
      socket.emit("currentRoomPlayers", { players: rooms[roomName] });
    });

    console.log(`🟢 Sala criada: ${roomName} por ${userName}`);
  });

  socket.on("joinRoom", (roomName: string, userName: string) => {
    if (!rooms[roomName]) rooms[roomName] = [];

    const player: Player = {
      id: socket.id,
      userName,
      roomAdmin: rooms[roomName].length === 0
    };

    addPlayerToRoom(roomName, player);
    socket.join(roomName);

    io.in(roomName).emit("currentRoomPlayers", { players: rooms[roomName] });
    console.log(`👤 ${userName} entrou na sala ${roomName}`);
  });

  socket.on("startGame", (roomName: string) => {
    const roomPlayers = rooms[roomName];
    if (!roomPlayers || roomPlayers.length === 0) return;

    const currentGame = availableGames[getRandomNumber(0, availableGames.length - 1)];

    io.in(roomName).emit("gameStarted", {
      message: `O jogo da sala ${roomName} começou!`,
      game: currentGame
    });

    if (currentGame === "FiveLetters") {
      const controller = new FiveLettersController(roomName, roomPlayers, io);
      activeGameControllers[roomName] = controller;

      io.in(roomName).emit("fiveLettersUpdate", {
        currentGameState: controller.getGameState()
      });
    }

    console.log(`🎮 Jogo iniciado na sala ${roomName}: ${currentGame}`);
  });

  socket.on("submitGuess", (roomName: string, word: string) => {
    const gameController = activeGameControllers[roomName];
    if (!gameController) {
      socket.emit('guessError', { message: 'Nenhum jogo ativo nesta sala.' });
      return;
    }
    gameController.handleGuess(socket.id, word);
  });

  socket.on("disconnect", () => {
    for (const [roomName, players] of Object.entries(rooms)) {
      rooms[roomName] = players.filter(p => p.id !== socket.id);

      if (rooms[roomName].length === 0) {
        delete rooms[roomName];
        delete activeGameControllers[roomName];
        console.log(`❌ Sala ${roomName} removida (vazia)`);
      } else {
        io.in(roomName).emit("currentRoomPlayers", { players: rooms[roomName] });
      }
    }

    console.log("🔌 Usuário desconectado:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
