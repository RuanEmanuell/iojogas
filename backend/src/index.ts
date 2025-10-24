import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";

const app = express();
const PORT = 3000;
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Express com TypeScript 🚀');
});

io.on('connection', (socket) => {
  socket.on("createRoom", (roomName) => {
    socket.join(roomName);
    console.log(`Sala criada: ${roomName} pelo usuário ${socket.id}`);

    socket.emit("roomCreated", {
      roomName,
      message: `Sala "${roomName}" criada com sucesso!`
    });
  });
});


server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
