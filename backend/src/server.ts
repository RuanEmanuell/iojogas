import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { Player } from './types/Player';
import { Question } from './types/Question';
import { questionList } from './utils/questions';
import { normalizeText } from './utils/normalizeText';

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

let QUESTION_TIME = 20;
let MAX_SCORE = 100;

let playerList: Player[] = [];

let gameStarted = false;
let currentQuestion: Question | null = null;
let answered = false;
let timeLeft = QUESTION_TIME;
let questionTimer: NodeJS.Timeout | null = null;
let usedQuestions: Set<number> = new Set();

// trava para evitar duas perguntas simultâneas
let isChangingQuestion = false;

/* -----------------------------------------
   FLAPPY BIRD STATE
----------------------------------------- */
interface Bird {
  id: string;
  name: string;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  score: number;
}

let flappyBirdGameActive = false;
let flappyBirds: Bird[] = [];
let flappyPipe = {
  x: 360,
  topHeight: 150,
  gap: 160,
  width: 70
};
let flappyTimer: NodeJS.Timeout | null = null;

/* -----------------------------------------
   FUNÇÕES IMPORTANTES
----------------------------------------- */

function resetGame() {
  gameStarted = false;
  answered = false;
  currentQuestion = null;
  flappyBirdGameActive = false;
  
  // Reset Flappy Bird state
  flappyBirds = [];
  flappyPipe = {
    x: 360,
    topHeight: 150,
    gap: 160,
    width: 70
  };
  
  if (flappyTimer) {
    clearInterval(flappyTimer);
    flappyTimer = null;
  }

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

  const availableQuestions = questionList.filter(q => !usedQuestions.has(q.id));

  // Sorteia uma pergunta nova
  currentQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

  // Adiciona à blacklist
  usedQuestions.add(currentQuestion.id);

  io.emit("changeQuestion", currentQuestion);
  io.emit("timerUpdate", timeLeft);

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

        io.emit("timerFinished", {
          correctAnswer: currentQuestion?.answers[0]
        });

        isChangingQuestion = false;
        setTimeout(() => {
          changeQuestion();
        }, 3000);
      }

    }, 1000);

    isChangingQuestion = false;

  }, 50);
}

/* -----------------------------------------
   FLAPPY BIRD FUNCTIONS
----------------------------------------- */

function randomPipeHeight() {
  const groundY = 640 - 120;
  const min = 80;
  const max = groundY - 120 - min;
  return Math.floor(Math.random() * (max - min) + min);
}

function startFlappyBirdGame() {
  flappyBirdGameActive = true;
  
  // Criar pássaro para cada player
  flappyBirds = playerList.map(p => ({
    id: p.id,
    name: p.name,
    x: 80,
    y: 150,
    vy: 0,
    alive: true,
    score: 0
  }));

  // Reset pipe
  flappyPipe = {
    x: 360,
    topHeight: randomPipeHeight(),
    gap: 160,
    width: 70
  };

  io.emit("flappyBirdStarted", { birds: flappyBirds, pipe: flappyPipe });

  // Game loop
  flappyTimer = setInterval(() => {
    updateFlappyBird();
  }, 1000 / 60); // 60 FPS
}

function updateFlappyBird() {
  if (!flappyBirdGameActive) return;

  const groundY = 640 - 120;

  // Update birds
  flappyBirds.forEach(bird => {
    if (!bird.alive) return;

    bird.vy += 0.2;
    bird.y += bird.vy;

    // Check collision with ground
    if (bird.y + 30 >= groundY) {
      bird.alive = false;
      io.emit("flappyBirdDeath", { birdId: bird.id });
    }

    // Check collision with pipes
    const birdRight = bird.x + 40;
    const birdBottom = bird.y + 30;

    if (
      birdRight > flappyPipe.x &&
      bird.x < flappyPipe.x + flappyPipe.width
    ) {
      if (
        bird.y < flappyPipe.topHeight ||
        birdBottom > flappyPipe.topHeight + flappyPipe.gap
      ) {
        bird.alive = false;
        io.emit("flappyBirdDeath", { birdId: bird.id });
      }
    }
  });

  // Update pipe
  flappyPipe.x -= 2;
  if (flappyPipe.x + flappyPipe.width < 0) {
    flappyPipe.x = 360;
    flappyPipe.topHeight = randomPipeHeight();

    // Increment score for alive birds
    flappyBirds.forEach(bird => {
      if (bird.alive) {
        bird.score++;
      }
    });
  }

  // Check if game is over
  const aliveBirds = flappyBirds.filter(b => b.alive);
  if (aliveBirds.length === 0) {
    stopFlappyBirdGame();
    return;
  }

  // Broadcast state
  io.emit("flappyBirdUpdate", {
    birds: flappyBirds,
    pipe: flappyPipe
  });
}

function stopFlappyBirdGame() {
  if (flappyTimer) {
    clearInterval(flappyTimer);
    flappyTimer = null;
  }

  // Find winner
  const winner = flappyBirds.reduce((max, bird) => 
    bird.score > max.score ? bird : max
  , flappyBirds[0]);

  io.emit("flappyBirdGameOver", { 
    winner,
    birds: flappyBirds 
  });

  setTimeout(() => {
    flappyBirdGameActive = false;
    io.emit("returnToLobby");
    resetGame();
  }, 5000);
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

  socket.emit("initialState", {
    gameStarted,
    currentQuestion,
    timeLeft,
    playerList
  });

  /* FORCE PLAYER LIST UPDATE */
  socket.on("requestPlayerListUpdate", () => {
    io.emit("playerListUpdate", playerList);
  });


  /* COMEÇAR JOGO (só o líder) */
  socket.on("startGame", ({ time, score }) => {

    if (!playerList.find(p => p.id === socket.id)?.leader) return;

    QUESTION_TIME = time;
    MAX_SCORE = score;

    usedQuestions.clear();
    gameStarted = true;

    io.emit("gameStarted", { time: QUESTION_TIME, score: MAX_SCORE });

    changeQuestion();
  });

  /* RESPONDER */
  socket.on("answer", (text: string) => {

    if (!gameStarted || !currentQuestion) {
      socket.emit("answerReceived", {
        text,
        accepted: false,
        reason: "No active question"
      });
      return;
    }

    if (answered) {
      socket.emit("answerReceived", {
        text,
        accepted: false,
        reason: "Already answered"
      });
      return;
    }

    // NORMALIZA A RESPOSTA DO PLAYER
    const normalized = normalizeText(text);
    const player = playerList.find(p => p.id === socket.id);

    // SEMPRE MANDA O MESMO PAYLOAD PARA TODOS
    const answerPayload = {
      text,
      accepted: true,
      playerName: player?.name
    };

    io.emit("answerReceived", answerPayload);

    // VERIFICA SE ACERTOU
    const isCorrect = currentQuestion.answers
      .map(a => normalizeText(a))
      .includes(normalized);

    /* ==========================
          RESPOSTA CORRETA
       ========================== */
    if (isCorrect) {
      answered = true;

      if (questionTimer) {
        clearInterval(questionTimer);
        questionTimer = null;
      }

      if (player) {
        player.score = (player.score || 0) + (timeLeft > 10 ? 10 : timeLeft);
      }

      io.emit("playerListUpdate", playerList);

      io.emit("correctAnswer", {
        id: socket.id,
        name: player?.name,
        answer: currentQuestion.answers[0],
        score: player?.score,
        time: QUESTION_TIME - timeLeft,
      });

      // CHECA VENCEDOR
      const winner = playerList.find(p => (p.score || 0) >= MAX_SCORE);
      if (winner) {
        io.emit("showWinner", { winner, playerList });

        setTimeout(() => {
          io.emit("returnToLobby");
          resetGame();
        }, 4000);

        return;
      }

      // Próxima pergunta
      setTimeout(() => {
        currentQuestion = null;
        answered = false;
        changeQuestion();
      }, 3000);

      return;
    }

    /* ==========================
          RESPOSTA ERRADA
       ========================== */

    io.emit("wrongAnswer", { text });

    io.emit("someoneTried", {
      id: socket.id,
      name: player?.name,
      text
    });

    socket.emit("unlockAnswer");
  });

  /* FLAPPY BIRD */
  socket.on("startFlappyBird", () => {
    if (!playerList.find(p => p.id === socket.id)?.leader) return;
    
    startFlappyBirdGame();
  });

  socket.on("flappyBirdFlap", () => {
    if (!flappyBirdGameActive) return;

    const bird = flappyBirds.find(b => b.id === socket.id);
    if (bird && bird.alive) {
      bird.vy = -6;
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