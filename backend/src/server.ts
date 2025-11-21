import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
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

let playerList: Player[] = [];

io.on("connection", (socket) => {
  socket.on("createPlayer", (name) => {
    const newPlayer = new Player(name, socket.id, 0, playerList.length === 0);
    playerList.push(newPlayer);

    io.emit("playerListUpdate", playerList);
  });

  socket.on("removePlayer", (id) => {
    playerList = playerList.filter(item => item.id !== id);

    io.emit("playerListUpdate", playerList);
  });

  socket.on("disconnect", () => {
    playerList = playerList.filter(item => item.id !== socket.id);

    if (playerList.length === 1) {
      playerList[0].leader = true;
    }

    io.emit("playerListUpdate", playerList);
  });
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Express com TypeScript 🚀');
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
