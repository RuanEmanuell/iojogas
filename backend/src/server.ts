import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { Player } from './types/Player';
import { Question } from './types/Question';

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
let questionList: Question[] = [
  { id: 1, category: "anime", answer: "Naruto", imageUrl: "naruto.jpg" },
  { id: 2, category: "anime", answer: "One Piece", imageUrl: "one_piece.jpg" },
  { id: 3, category: "anime", answer: "Attack on Titan", imageUrl: "attack_on_titan.jpg" },
  { id: 4, category: "anime", answer: "Fullmetal Alchemist", imageUrl: "fullmetal_alchemist.jpg" },
  { id: 5, category: "anime", answer: "Death Note", imageUrl: "death_note.jpg" },
  { id: 6, category: "anime", answer: "Dragon Ball", imageUrl: "dragon_ball.jpg" },
  { id: 7, category: "anime", answer: "My Hero Academia", imageUrl: "my_hero_academia.jpg" },
  { id: 8, category: "anime", answer: "Demon Slayer", imageUrl: "demon_slayer.jpg" },
  { id: 9, category: "anime", answer: "Tokyo Ghoul", imageUrl: "tokyo_ghoul.jpg" },
  { id: 10, category: "anime", answer: "Sword Art Online", imageUrl: "sword_art_online.jpg" },
  { id: 11, category: "anime", answer: "Bleach", imageUrl: "bleach.jpg" },
  { id: 12, category: "anime", answer: "Fairy Tail", imageUrl: "fairy_tail.jpg" },
  { id: 13, category: "anime", answer: "Cowboy Bebop", imageUrl: "cowboy_bepop.jpg" },
  { id: 14, category: "anime", answer: "Neon Genesis Evangelion", imageUrl: "neon_genesis_evangelion.jpg" },
  { id: 15, category: "anime", answer: "JoJo's Bizarre Adventure", imageUrl: "jojo.jpg" },
  { id: 16, category: "anime", answer: "Hunter x Hunter", imageUrl: "hunter_x_hunter.jpg" },
  { id: 17, category: "anime", answer: "Black Clover", imageUrl: "black_clover.jpg" },
  { id: 18, category: "anime", answer: "Gintama", imageUrl: "gintama.jpg" },
  { id: 19, category: "anime", answer: "Mob Psycho 100", imageUrl: "mob_psycho_100.jpg" },
  { id: 20, category: "anime", answer: "The Seven Deadly Sins", imageUrl: "seven_deadly_sins.jpg" },
  { id: 21, category: "pokemon", answer: "Bulbasaur", imageUrl: "bulbasaur.jpg" },
  { id: 22, category: "pokemon", answer: "Ivysaur", imageUrl: "ivysaur.jpg" },
  { id: 23, category: "pokemon", answer: "Venusaur", imageUrl: "venusaur.jpg" },
  { id: 24, category: "pokemon", answer: "Charmander", imageUrl: "charmander.jpg" },
  { id: 25, category: "pokemon", answer: "Charmeleon", imageUrl: "charmeleon.jpg" },
  { id: 26, category: "pokemon", answer: "Charizard", imageUrl: "charizard.jpg" },
  { id: 27, category: "pokemon", answer: "Squirtle", imageUrl: "squirtle.jpg" },
  { id: 28, category: "pokemon", answer: "Wartortle", imageUrl: "wartortle.jpg" },
  { id: 29, category: "pokemon", answer: "Blastoise", imageUrl: "blastoise.jpg" },
  { id: 30, category: "pokemon", answer: "Pikachu", imageUrl: "pikachu.jpg" },
  { id: 31, category: "pokemon", answer: "Raichu", imageUrl: "raichu.jpg" },
  { id: 32, category: "pokemon", answer: "Jigglypuff", imageUrl: "jigglypuff.jpg" },
  { id: 33, category: "pokemon", answer: "Meowth", imageUrl: "meowth.jpg" },
  { id: 34, category: "pokemon", answer: "Psyduck", imageUrl: "psyduck.jpg" },
  { id: 35, category: "pokemon", answer: "Machop", imageUrl: "machop.jpg" },
  { id: 36, category: "pokemon", answer: "Geodude", imageUrl: "geodude.jpg" },
  { id: 37, category: "pokemon", answer: "Eevee", imageUrl: "eevee.jpg" },
  { id: 38, category: "pokemon", answer: "Snorlax", imageUrl: "snorlax.jpg" },
  { id: 39, category: "pokemon", answer: "Mewtwo", imageUrl: "mewtwo.jpg" },
  { id: 40, category: "pokemon", answer: "Magikarp", imageUrl: "magikarp.jpg" }
];

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
        player.score = (player.score || 0) + (timeLeft > 10 ? 10 : timeLeft);
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