import express from 'express';
import { createServer } from 'node:http';
import { Server } from "socket.io";
import dotenv from "dotenv";
import { Player } from './types/Player';
import { Question } from './types/Question';
import { questionList } from './utils/questions';
import { normalizeText } from './utils/normalizeText';
import { impostorWords } from './utils/impostorWords';

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

// Impostor game timings (seconds)
const IMPOSTOR_DISCUSSION_TIME = 90;
const IMPOSTOR_VOTE_TIME = 30;

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
   IMPOSTOR STATE
----------------------------------------- */
type ImpostorPhase = "discussion" | "vote" | null;

let impostorGameActive = false;
let impostorId: string | null = null;
let impostorWord: string | null = null;
let impostorAlive: Set<string> = new Set();
let impostorVotes: Record<string, string> = {};
let impostorPhase: ImpostorPhase = null;
let impostorTimeLeft = 0;
let impostorTimer: NodeJS.Timeout | null = null;
let impostorRound = 0;

/* -----------------------------------------
   FUNÇÕES IMPORTANTES
----------------------------------------- */

function resetGame() {
  gameStarted = false;
  answered = false;
  currentQuestion = null;
  flappyBirdGameActive = false;

  impostorGameActive = false;
  impostorId = null;
  impostorWord = null;
  impostorAlive = new Set();
  impostorVotes = {};
  impostorPhase = null;
  impostorTimeLeft = 0;
  impostorRound = 0;
  if (impostorTimer) {
    clearInterval(impostorTimer);
    impostorTimer = null;
  }
  
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

  // Iniciar update periódico LEVE (apenas para sincronizar posições, não física)
  flappyTimer = setInterval(() => {
    broadcastPositions();
  }, 1000 / 60); // 60 FPS
}

// Broadcast de posições para sincronização leve
function broadcastPositions() {
  if (!flappyBirdGameActive) return;

  // Atualizar pipe do servidor (fazer progresso mesmo se nenhum cliente reportar)
  flappyPipe.x -= 2.5; // mesma velocidade do cliente
  
  // Resetar pipe quando sai da tela
  if (flappyPipe.x + flappyPipe.width < 0) {
    flappyPipe.x = 360;
    flappyPipe.topHeight = randomPipeHeight();
  }

  // Enviar para TODOS os clientes o estado atual
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
   IMPOSTOR FUNCTIONS
----------------------------------------- */

function pickImpostorWord(): string {
  return impostorWords[Math.floor(Math.random() * impostorWords.length)] || "mistério";
}

function startImpostorTimer(onEnd: () => void) {
  if (impostorTimer) clearInterval(impostorTimer);
  impostorTimer = setInterval(() => {
    impostorTimeLeft--;
    io.emit("impostorTimer", {
      phase: impostorPhase,
      timeLeft: impostorTimeLeft,
      round: impostorRound,
      alive: Array.from(impostorAlive)
    });

    if (impostorTimeLeft <= 0) {
      if (impostorTimer) {
        clearInterval(impostorTimer);
        impostorTimer = null;
      }
      onEnd();
    }
  }, 1000);
}

function broadcastImpostorRoundInfo() {
  playerList.forEach(p => {
    const isImpostor = p.id === impostorId;
    io.to(p.id).emit("impostorRound", {
      round: impostorRound,
      role: isImpostor ? "impostor" : "crew",
      word: isImpostor ? null : impostorWord,
      alive: Array.from(impostorAlive),
      phase: impostorPhase,
      timeLeft: impostorTimeLeft
    });
  });
}

function startImpostorDiscussion(isFirstRound = false) {
  impostorPhase = "discussion";
  impostorTimeLeft = IMPOSTOR_DISCUSSION_TIME;
  impostorVotes = {};
  if (!isFirstRound) {
    impostorRound += 1;
    // Palavra permanece a mesma durante todo o jogo
  }

  broadcastImpostorRoundInfo();
  startImpostorTimer(() => startImpostorVotePhase());
}

function startImpostorVotePhase() {
  impostorPhase = "vote";
  impostorTimeLeft = IMPOSTOR_VOTE_TIME;
  impostorVotes = {};

  io.emit("impostorVoteStart", {
    timeLeft: impostorTimeLeft,
    round: impostorRound,
    alive: Array.from(impostorAlive)
  });

  startImpostorTimer(() => endImpostorVotePhase());
}

function computeVoteResult() {
  const tally: Record<string, number> = {};
  Object.values(impostorVotes).forEach(targetId => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  let topId: string | null = null;
  let topVotes = 0;
  let tie = false;

  Object.entries(tally).forEach(([id, count]) => {
    if (count > topVotes) {
      topVotes = count;
      topId = id;
      tie = false;
    } else if (count === topVotes) {
      tie = true;
    }
  });

  if (topVotes === 0 || tie) {
    return { eliminated: null, tie: true };
  }

  return { eliminated: topId, tie: false };
}

function checkImpostorWinConditions() {
  const aliveArray = Array.from(impostorAlive);
  const impostorAliveStill = impostorId ? impostorAlive.has(impostorId) : false;

  if (!impostorAliveStill) {
    stopImpostorGame("crew");
    return true;
  }

  // Se só restam impostor + 1
  if (aliveArray.length <= 2 && impostorAliveStill) {
    stopImpostorGame("impostor");
    return true;
  }

  return false;
}

function endImpostorVotePhase() {
  if (impostorTimer) {
    clearInterval(impostorTimer);
    impostorTimer = null;
  }

  const { eliminated, tie } = computeVoteResult();

  if (eliminated) {
    impostorAlive.delete(eliminated);
  }

  io.emit("impostorVoteResult", {
    eliminated,
    tie,
    alive: Array.from(impostorAlive),
    round: impostorRound
  });

  // Verifica condições de vitória
  if (checkImpostorWinConditions()) return;

  // Próxima rodada
  startImpostorDiscussion();
}

function stopImpostorGame(winner: "crew" | "impostor") {
  if (impostorTimer) {
    clearInterval(impostorTimer);
    impostorTimer = null;
  }

  impostorGameActive = false;

  io.emit("impostorGameOver", {
    winner,
    impostorId,
    word: impostorWord
  });

  setTimeout(() => {
    io.emit("returnToLobby");
    resetGame();
  }, 5000);
}

function startImpostorGame() {
  impostorGameActive = true;
  impostorRound = 1;
  impostorWord = pickImpostorWord();
  impostorPhase = "discussion";
  impostorTimeLeft = IMPOSTOR_DISCUSSION_TIME;
  impostorVotes = {};
  impostorAlive = new Set(playerList.map(p => p.id));

  // Escolhe impostor
  const pick = playerList[Math.floor(Math.random() * playerList.length)];
  impostorId = pick?.id || null;

  if (impostorTimer) {
    clearInterval(impostorTimer);
    impostorTimer = null;
  }

  // Enviar papel e palavra individualmente
  playerList.forEach(p => {
    const isImpostor = p.id === impostorId;
    io.to(p.id).emit("impostorGameStarted", {
      role: isImpostor ? "impostor" : "crew",
      word: isImpostor ? null : impostorWord,
      alive: Array.from(impostorAlive),
      phase: impostorPhase,
      timeLeft: impostorTimeLeft,
      round: impostorRound
    });
  });

  startImpostorTimer(() => startImpostorVotePhase());
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

    if (impostorGameActive) {
      impostorAlive.delete(socket.id);
      checkImpostorWinConditions();
    }
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

  /* COMEÇAR IMPOSTOR (só o líder) */
  socket.on("startImpostorGame", () => {
    if (!playerList.find(p => p.id === socket.id)?.leader) return;
    if (playerList.length < 3) {
      socket.emit("impostorError", { message: "É preciso pelo menos 3 jogadores." });
      return;
    }

    // Zera qualquer jogo anterior
    resetGame();

    startImpostorGame();
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
      bird.vy = -10; // Atualizar no servidor também
    }
  });

  // Cliente reporta sua posição periodicamente
  socket.on("flappyBirdPosition", (data: { x: number, y: number, vy: number, score: number, pipe?: any }) => {
    if (!flappyBirdGameActive) return;

    const bird = flappyBirds.find(b => b.id === socket.id);
    if (bird && bird.alive) {
      bird.x = data.x;
      bird.y = data.y;
      bird.vy = data.vy;
      bird.score = data.score;
      // Não atualizar pipe aqui - o servidor mantém itém em broadcastPositions()
    }
  });

  // Cliente reporta sua morte
  socket.on("flappyBirdDeath", (data: { score: number }) => {
    if (!flappyBirdGameActive) return;

    const bird = flappyBirds.find(b => b.id === socket.id);
    if (bird && bird.alive) {
      bird.alive = false;
      bird.score = data.score;
      
      // Notificar todos
      io.emit("flappyBirdDeath", { birdId: bird.id });

      // Verificar se o jogo acabou
      const aliveBirds = flappyBirds.filter(b => b.alive);
      if (aliveBirds.length === 0) {
        stopFlappyBirdGame();
      }
    }
  });

  /* IMPOSTOR VOTE */
  socket.on("impostorVote", ({ targetId }) => {
    if (!impostorGameActive || impostorPhase !== "vote") return
    if (!impostorAlive.has(socket.id)) return;
    if (!impostorAlive.has(targetId)) return;

    impostorVotes[socket.id] = targetId;

    io.to(socket.id).emit("impostorVoteAck", { targetId });
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