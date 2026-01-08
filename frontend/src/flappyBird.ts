import { Socket } from "socket.io-client";

interface Bird {
  id: string;
  name: string;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  score: number;
  scoredThisFrame?: boolean;
}

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  width: number;
}

// Estado global do jogo
let globalGameState = {
  birds: [] as Bird[],
  pipe: { x: 360, topHeight: 150, gap: 160, width: 70 } as Pipe,
  floorX: 0,
  gameOver: false,
  isRunning: false,
  loopActive: true,
  myId: "" as string
};

// Socket listeners serão configurados dentro de initFlappyBird

export function initFlappyBird(socket: Socket, myId: string, initialData: { birds: Bird[], pipe: Pipe }) {
  // Remover listeners antigos ANTES de resetar
  socket.off("flappyBirdStarted");
  socket.off("flappyBirdUpdate");
  socket.off("flappyBirdDeath");
  socket.off("flappyBirdGameOver");

  // Resetar estado global completamente
  globalGameState = {
    birds: initialData.birds.map(b => ({ ...b, scoredThisFrame: false })),
    pipe: { ...initialData.pipe },
    floorX: 0,
    gameOver: false,
    isRunning: true,
    loopActive: true,
    myId: myId
  };
  
  // Setup socket listeners (recria a cada jogo)
  socket.on("flappyBirdStarted", (data: { birds: Bird[], pipe: Pipe }) => {
    globalGameState.birds = data.birds.map(b => ({ ...b, scoredThisFrame: false }));
    globalGameState.pipe = data.pipe;
    globalGameState.gameOver = false;
    globalGameState.isRunning = true;
    globalGameState.loopActive = true;
    globalGameState.floorX = 0;
  });

  socket.on("flappyBirdUpdate", (data: { birds: Bird[], pipe: Pipe }) => {
    globalGameState.pipe = data.pipe;

    data.birds.forEach(serverBird => {
      const localBird = globalGameState.birds.find(b => b.id === serverBird.id);
      if (localBird) {
        const isMe = serverBird.id === myId;
        const shouldUpdate = !isMe;

        if (shouldUpdate) {
          localBird.x = serverBird.x;
          localBird.y = serverBird.y;
          localBird.vy = serverBird.vy;
          localBird.alive = serverBird.alive;
          localBird.score = serverBird.score;
        }
      }
    });
  });

  socket.on("flappyBirdDeath", (data: { birdId: string }) => {
    const bird = globalGameState.birds.find(b => b.id === data.birdId);
    if (bird) {
      bird.alive = false;
    }
  });

  socket.on("flappyBirdGameOver", (data: { winner: Bird, birds: Bird[] }) => {
    globalGameState.gameOver = true;
    globalGameState.birds = data.birds;
    globalGameState.isRunning = false;
    globalGameState.loopActive = true;
  });
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas não encontrado!");
    return () => {}; // Retornar função vazia se canvas não existir
  }

  const ctx = canvas.getContext("2d")!;

  const logicalWidth = 360;
  const logicalHeight = 640;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  canvas.style.width = logicalWidth + "px";
  canvas.style.height = logicalHeight + "px";

  ctx.scale(dpr, dpr);

  const scale = Math.min(window.innerWidth / 360, window.innerHeight / 640, 1.5);
  canvas.style.transform = `scale(${scale})`;

  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;

  let lastTime = 0;
  let lastFrameTime = 0;
  let canPlayFlap = true;

  /* ================= STATE FROM SERVER ================= */
  // Usar referência ao estado global
  const gameState = globalGameState;

  /* ================= IMAGENS ================= */
  const birdImg = new Image();
  birdImg.src = "/images/bird.png";

  const pipeImg = new Image();
  pipeImg.src = "/images/pipe.png";

  const floorImg = new Image();
  floorImg.src = "/images/floor.png";

  const backgroundImg = new Image();
  backgroundImg.src = "/images/background.png";

  // Fallback colors se as imagens não carregarem
  const birdColors = [
    '#FFD700', '#FF6347', '#4169E1', '#32CD32', 
    '#FF69B4', '#FF8C00', '#9370DB', '#00CED1'
  ];

  /* ================= SONS ================= */
  const flapSound = new Audio("/sounds/flap.mp3");
  const scoreSound = new Audio("/sounds/score.mp3");

  flapSound.preload = "auto";
  scoreSound.preload = "auto";

  function playFlap() {
    if (!canPlayFlap) return;

    canPlayFlap = false;

    flapSound.currentTime = 0;
    //flapSound.play().catch(e => console.log(e));

    setTimeout(() => {
      canPlayFlap = true;
    }, 250);
  }

  /* ================= WORLD ================= */
  const FLOOR_HEIGHT = 120;
  const groundY = logicalHeight - FLOOR_HEIGHT;

  // Constantes de física
  const GRAVITY = 0.5;
  const JUMP_VELOCITY = -9;
  const PIPE_SPEED = 1.8;
  const FLOOR_SPEED = 1.5;

  /* ================= SOCKET EVENTS ================= */
  // Socket listeners já estão configurados globalmente

  /* ================= UPDATE (FÍSICA LOCAL) ================= */
  function update(deltaTime: number) {
    if (!gameState.isRunning) return;

    // Normalizar delta time para 60 FPS (deltaTime em ms, normalizar para segundos * 60)
    const dt = (deltaTime / 1000) * 60;

    // Update floor animation
    gameState.floorX -= FLOOR_SPEED * dt;
    if (gameState.floorX <= -logicalWidth) gameState.floorX = 0;

    // Mover pipe
    gameState.pipe.x -= PIPE_SPEED * dt;

    // Se pipe passou da tela, resetar
    if (gameState.pipe.x + gameState.pipe.width < 0) {
      gameState.pipe.x = logicalWidth;
      // Gerar nova altura aleatória
      gameState.pipe.topHeight = Math.floor(Math.random() * 200) + 100;
    }

    // Atualizar MEU pássaro localmente
    const myBird = gameState.birds.find(b => b.id === myId);
    if (myBird && myBird.alive) {
      // Aplicar gravidade
      myBird.vy += GRAVITY * dt;
      myBird.y += myBird.vy * dt;

      // Verificar colisões localmente
      const hitGround = myBird.y + 30 >= groundY;
      const hitCeiling = myBird.y <= 0;
      
      // Colisão com pipe
      const birdRight = myBird.x + 40;
      const birdBottom = myBird.y + 30;
      const birdLeft = myBird.x;
      const birdTop = myBird.y;

      const pipeRight = gameState.pipe.x + gameState.pipe.width;
      const pipeLeft = gameState.pipe.x;
      const topPipeBottom = gameState.pipe.topHeight;
      const bottomPipeTop = gameState.pipe.topHeight + gameState.pipe.gap;

      const hitPipe = 
        birdRight > pipeLeft && 
        birdLeft < pipeRight && 
        (birdTop < topPipeBottom || birdBottom > bottomPipeTop);

      // Se morreu, avisar servidor
      if (hitGround || hitCeiling || hitPipe) {
        myBird.alive = false;
        socket.emit("flappyBirdDeath", { score: myBird.score });
      }

    // Verificar se passou pelo pipe (pontuar)
    // Contar quando o pipe passa completamente pelo pássaro
    if (myBird.alive && !myBird.scoredThisFrame) {
      const pipeRight = gameState.pipe.x + gameState.pipe.width;
      const birdCenterX = myBird.x + 20; // Centro do pássaro
      
      // Se o pipe estava à direita e agora passou (está à esquerda)
      if (pipeRight <= birdCenterX && pipeRight + (PIPE_SPEED * dt * 2) > birdCenterX) {
        myBird.score++;
        myBird.scoredThisFrame = true;
        scoreSound.currentTime = 0;
        scoreSound.play().catch(e => console.log(e));
      }
    }
    
    // Reset flag quando o pipe ficou bem distante para trás
    if (gameState.pipe.x + gameState.pipe.width < myBird.x - 100) {
      myBird.scoredThisFrame = false;
    }
      
      // Enviar posição a cada frame (~60 FPS)
      const payload = {
        x: myBird.x,
        y: myBird.y,
        vy: myBird.vy,
        score: myBird.score
      };
      
      socket.emit("flappyBirdPosition", payload);
    }
  }

  /* ================= DRAW ================= */
  function draw() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Background
    if (backgroundImg.complete && backgroundImg.naturalHeight !== 0) {
      ctx.drawImage(backgroundImg, 0, 0, logicalWidth, logicalHeight);
    } else {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }

    drawPipes();

    // Draw all birds
    gameState.birds.forEach((bird, index) => {
      if (!bird.alive) return;

      const color = birdColors[index % birdColors.length];
      
      if (birdImg.complete && birdImg.naturalHeight !== 0) {
        ctx.save();
        
        // Tint the bird with player color
        if (bird.id === myId) {
          ctx.globalAlpha = 1;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        } else {
          ctx.globalAlpha = 0.7;
        }
        
        ctx.drawImage(birdImg, bird.x, bird.y, 40, 30);
        ctx.restore();
      } else {
        // Fallback: draw colored rectangle
        ctx.fillStyle = color;
        ctx.fillRect(bird.x, bird.y, 40, 30);
      }

      // Draw player name
      ctx.font = "12px Arial";
      ctx.fillStyle = bird.id === myId ? "yellow" : "white";
      ctx.textAlign = "center";
      ctx.fillText(bird.name, bird.x + 20, bird.y - 5);
    });

    // Draw floor
    if (floorImg.complete && floorImg.naturalHeight !== 0) {
      ctx.drawImage(floorImg, 0, groundY, logicalWidth + 5, 120);
      ctx.drawImage(floorImg, logicalWidth, groundY, logicalWidth, 120);
    } else {
      ctx.fillStyle = '#DEB887';
      ctx.fillRect(0, groundY, logicalWidth, 120);
    }

    // Draw scores
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    let yOffset = 40;
    gameState.birds.forEach((bird, index) => {
      const color = birdColors[index % birdColors.length];
      ctx.fillStyle = bird.alive ? color : "gray";
      ctx.fillText(`${bird.name}: ${bird.score}`, 10, yOffset);
      yOffset += 20;
    });

    if (gameState.gameOver) {
      drawGameOver();
    }
  }

  /* ================= PIPES ================= */
  function drawPipes() {
    if (pipeImg.complete && pipeImg.naturalHeight !== 0) {
      // Top pipe (inverted)
      ctx.save();
      ctx.translate(gameState.pipe.x, gameState.pipe.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImg, 0, 0, gameState.pipe.width, gameState.pipe.topHeight);
      ctx.restore();

      // Bottom pipe
      const bottomY = gameState.pipe.topHeight + gameState.pipe.gap;
      const bottomHeight = groundY - bottomY;
      ctx.drawImage(pipeImg, gameState.pipe.x, bottomY, gameState.pipe.width, bottomHeight);
    } else {
      // Fallback: draw green rectangles
      ctx.fillStyle = '#228B22';
      
      // Top pipe
      ctx.fillRect(gameState.pipe.x, 0, gameState.pipe.width, gameState.pipe.topHeight);
      
      // Bottom pipe
      const bottomY = gameState.pipe.topHeight + gameState.pipe.gap;
      const bottomHeight = groundY - bottomY;
      ctx.fillRect(gameState.pipe.x, bottomY, gameState.pipe.width, bottomHeight);
    }
  }

  /* ================= GAME OVER ================= */
  function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = "red";
    ctx.font = "48px Arial Black";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", logicalWidth / 2, logicalHeight / 2 - 60);

    // Show winner
    const winner = gameState.birds.reduce((max, bird) => 
      bird.score > max.score ? bird : max
    , gameState.birds[0]);

    ctx.font = "24px Arial";
    ctx.fillStyle = "yellow";
    ctx.fillText(`🏆 ${winner.name} venceu!`, logicalWidth / 2, logicalHeight / 2 - 20);
    ctx.fillStyle = "white";
    ctx.fillText(`${winner.score} pontos`, logicalWidth / 2, logicalHeight / 2 + 10);
  }

  /* ================= LOOP ================= */
  let animationFrameId: number;

  function loop(time: number) {
    if (!gameState.loopActive) return; // Parar apenas quando desmontar

    animationFrameId = requestAnimationFrame(loop);

    if (!lastTime) lastTime = time;
    if (!lastFrameTime) lastFrameTime = time;

    const delta = time - lastTime;
    
    // Proteger contra Alt+Tab: ignorar frames com delta muito grande (> 1 segundo)
    if (delta > 1000) {
      lastTime = time;
      lastFrameTime = time;
      return;
    }
    
    // Limitar a 60 FPS - só processar se passou tempo suficiente
    if (delta < FRAME_TIME) return;
    
    // Calcular deltaTime real desde o último frame processado
    let deltaTime = time - lastFrameTime;
    
    // Proteger contra deltaTime gigante
    if (deltaTime > 100) {
      deltaTime = FRAME_TIME;
    }
    
    lastFrameTime = time;
    lastTime = time - (delta % FRAME_TIME); // Manter precisão

    // Atualizar física se o jogo ainda estiver rodando (com deltaTime)
    if (gameState.isRunning) {
      update(deltaTime);
    }

    draw();
  }

  animationFrameId = requestAnimationFrame(loop);

  /* ================= INPUT ================= */
  const handleClick = () => {
    if (!gameState.gameOver && gameState.isRunning) {
      const myBird = gameState.birds.find(b => b.id === myId);
      if (myBird && myBird.alive) {
        // Aplicar pulo localmente (instantâneo!)
        myBird.vy = JUMP_VELOCITY;
        playFlap();
        
        // Avisar servidor (mas não esperar resposta)
        socket.emit("flappyBirdFlap");
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" && !gameState.gameOver && gameState.isRunning) {
      e.preventDefault();
      const myBird = gameState.birds.find(b => b.id === myId);
      if (myBird && myBird.alive) {
        // Aplicar pulo localmente (instantâneo!)
        myBird.vy = JUMP_VELOCITY;
        playFlap();
        
        // Avisar servidor (mas não esperar resposta)
        socket.emit("flappyBirdFlap");
      }
    }
  };

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeyDown);

  // Retornar função de cleanup
  return () => {
    gameState.loopActive = false; // Para o loop
    gameState.isRunning = false;
    cancelAnimationFrame(animationFrameId);
    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeyDown);
    
    // Aguardar um tick antes de remover listeners para evitar race conditions
    setTimeout(() => {
      socket.off("flappyBirdStarted");
      socket.off("flappyBirdUpdate");
      socket.off("flappyBirdDeath");
      socket.off("flappyBirdGameOver");
    }, 0);
  };
}
