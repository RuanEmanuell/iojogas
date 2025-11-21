import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { Player } from './types/Player';
import { Question } from './types/Question';
import { questionList } from './utils/questions';

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

/* -----------------------------------------
   ESTADO GLOBAL DO JOGO
----------------------------------------- */

const QUESTION_TIME = 20;
const MAX_SCORE = 100;

let playerList: Player[] = [];

let gameStarted = false;
let currentQuestion: Question | null = null;
let answered = false;
let timeLeft = QUESTION_TIME;
let questionTimer: NodeJS.Timeout | null = null;

// trava para evitar duas perguntas simultâneas
let isChangingQuestion = false;

/* -----------------------------------------
   FUNÇÕES IMPORTANTES
----------------------------------------- */

function resetGame() {
  gameStarted = false;
  answered = false;
  currentQuestion = null;

  playerList.forEach(p => p.score = 0);

  io.emit("playerListUpdate", playerList);
}

function giveNewLeaderIfNeeded() {
  if (!playerList.some(p => p.leader) && playerList.length > 0) {
    playerList[0].leader = true;

    if (gameStarted) {
      io.emit("returnToLobby");
      resetGame();
    }
  }
}

function changeQuestion() {
  if (isChangingQuestion) return;
  isChangingQuestion = true;

  if (questionTimer) {
    clearInterval(questionTimer);
    questionTimer = null;
  }

  timeLeft = QUESTION_TIME;
  answered = false;

  currentQuestion = questionList[Math.floor(Math.random() * questionList.length)];
  io.emit("changeQuestion", currentQuestion);

  // evitar chamada dupla
  setTimeout(() => {

    questionTimer = setInterval(() => {
      timeLeft--;
      io.emit("timerUpdate", timeLeft);

      const winner = playerList.find(p => (p.score || 0) >= MAX_SCORE);
      if (winner) {
        clearInterval(questionTimer!);
        questionTimer = null;

        // === ADD AQUI ===
        io.emit("showWinner", { winner, playerList });

        setTimeout(() => {
          io.emit("returnToLobby");
          resetGame();
        }, 5000); 

        return;
      }

      if (timeLeft <= 0) {
        clearInterval(questionTimer!);
        questionTimer = null;

        io.emit("timerFinished");

        isChangingQuestion = false;
        changeQuestion();
      }

    }, 1000);

    isChangingQuestion = false;

  }, 50);
}

/* -----------------------------------------
   SOCKET.IO
----------------------------------------- */

io.on("connection", (socket) => {

  /* PLAYER CRIADO */
  socket.on("createPlayer", (name) => {
    const newPlayer = new Player(name, socket.id, 0, playerList.length === 0);
    playerList.push(newPlayer);

    io.emit("playerListUpdate", playerList);
  });

  /* REMOVER PLAYER MANUALMENTE */
  socket.on("removePlayer", (id) => {
    playerList = playerList.filter(p => p.id !== id);
    giveNewLeaderIfNeeded();
    io.emit("playerListUpdate", playerList);
  });

  /* PLAYER DESCONECTOU */
  socket.on("disconnect", () => {
    playerList = playerList.filter(p => p.id !== socket.id);
    giveNewLeaderIfNeeded();
    io.emit("playerListUpdate", playerList);
  });

  /* COMEÇAR JOGO (só o líder) */
  socket.on("startGame", () => {
    const pl = playerList.find(p => p.id === socket.id);
    if (!pl?.leader) return;

    if (gameStarted) return;

    gameStarted = true;
    io.emit("gameStarted");

    changeQuestion();
  });

  /* RESPONDER */
  socket.on("answer", (text: string) => {

    if (!gameStarted || !currentQuestion) {
      socket.emit("answerReceived", { text, accepted: false, reason: "No active question" });
      return;
    }

    if (answered) {
      socket.emit("answerReceived", { text, accepted: false, reason: "Already answered" });
      return;
    }

    const normalized = (text || "").trim().toLowerCase();
    const correct = currentQuestion.answer.trim().toLowerCase();

    socket.emit("answerReceived", { text, accepted: true });

    // ACERTOU
    if (normalized === correct) {
      answered = true;

      if (questionTimer) {
        clearInterval(questionTimer);
        questionTimer = null;
      }

      const player = playerList.find(p => p.id === socket.id);
      if (player) {
        player.score = (player.score || 0) + (Math.trunc((timeLeft / 2)) + 1);
      }

      io.emit("playerListUpdate", playerList);

      io.emit("correctAnswer", {
        id: socket.id,
        name: player?.name,
        answer: currentQuestion.answer,
        score: player?.score
      });

      const winner = playerList.find(p => (p.score || 0) >= MAX_SCORE);
      if (winner) {
        io.emit("showWinner", { winner, playerList });

        setTimeout(() => {
          io.emit("returnToLobby");
          resetGame();
        }, 4000);

        return;
      }

      setTimeout(() => {
        currentQuestion = null;
        answered = false;
        changeQuestion();
      }, 3000);

      } else {
        socket.emit("answerReceived", { text, accepted: true });
        socket.emit("wrongAnswer", { text });     
        io.emit("someoneTried", { id: socket.id, text });

        // Libera o input pra tentar de novo
        socket.emit("unlockAnswer");
      }
  });
});

/* -----------------------------------------
   EXPRESS
----------------------------------------- */

app.use(express.json());

app.get('/', (req, res) => {
  res.send("Servidor Express com TypeScript rodando 🚀");
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});