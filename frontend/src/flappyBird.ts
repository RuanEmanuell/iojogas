import { Socket } from "socket.io-client";

interface Bird {
  id: string;
  name: string;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  score: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  width: number;
}

export function initFlappyBird(socket: Socket, myId: string) {
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas não encontrado!");
    return;
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
  let accumulator = 0;

  /* ================= STATE FROM SERVER ================= */
  let birds: Bird[] = [];
  let pipe: Pipe = {
    x: 360,
    topHeight: 150,
    gap: 160,
    width: 70
  };
  let floorX = 0;
  let gameOver = false;

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

  let canPlayFlap = true;
  const flapCooldown = 250;

  function playFlap() {
    if (!canPlayFlap) return;

    canPlayFlap = false;

    flapSound.currentTime = 0;
    flapSound.play().catch(e => console.log(e));

    setTimeout(() => {
      canPlayFlap = true;
    }, flapCooldown);
  }

  function playScore() {
    scoreSound.currentTime = 0;
    scoreSound.play();
  }

  /* ================= WORLD ================= */
  const FLOOR_HEIGHT = 120;
  const groundY = logicalHeight - FLOOR_HEIGHT;

  /* ================= SOCKET EVENTS ================= */
  socket.on("flappyBirdStarted", (data: { birds: Bird[], pipe: Pipe }) => {
    birds = data.birds;
    pipe = data.pipe;
    gameOver = false;
    floorX = 0;
  });

  socket.on("flappyBirdUpdate", (data: { birds: Bird[], pipe: Pipe }) => {
    birds = data.birds;
    pipe = data.pipe;
  });

  socket.on("flappyBirdDeath", (data: { birdId: string }) => {
    const bird = birds.find(b => b.id === data.birdId);
    if (bird) {
      bird.alive = false;
    }
  });

  socket.on("flappyBirdGameOver", (data: { winner: Bird, birds: Bird[] }) => {
    gameOver = true;
    birds = data.birds;
  });

  /* ================= UPDATE ================= */
  function update() {
    // Update floor animation
    floorX -= 2;
    if (floorX <= -logicalWidth) floorX = 0;
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
    birds.forEach((bird, index) => {
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
      ctx.drawImage(floorImg, floorX, groundY, logicalWidth + 5, 120);
      ctx.drawImage(floorImg, floorX + logicalWidth, groundY, logicalWidth, 120);
    } else {
      ctx.fillStyle = '#DEB887';
      ctx.fillRect(0, groundY, logicalWidth, 120);
    }

    // Draw scores
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    let yOffset = 40;
    birds.forEach((bird, index) => {
      const color = birdColors[index % birdColors.length];
      ctx.fillStyle = bird.alive ? color : "gray";
      ctx.fillText(`${bird.name}: ${bird.score}`, 10, yOffset);
      yOffset += 20;
    });

    if (gameOver) {
      drawGameOver();
    }
  }

  /* ================= PIPES ================= */
  function drawPipes() {
    if (pipeImg.complete && pipeImg.naturalHeight !== 0) {
      // Top pipe (inverted)
      ctx.save();
      ctx.translate(pipe.x, pipe.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImg, 0, 0, pipe.width, pipe.topHeight);
      ctx.restore();

      // Bottom pipe
      const bottomY = pipe.topHeight + pipe.gap;
      const bottomHeight = groundY - bottomY;
      ctx.drawImage(pipeImg, pipe.x, bottomY, pipe.width, bottomHeight);
    } else {
      // Fallback: draw green rectangles
      ctx.fillStyle = '#228B22';
      
      // Top pipe
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      
      // Bottom pipe
      const bottomY = pipe.topHeight + pipe.gap;
      const bottomHeight = groundY - bottomY;
      ctx.fillRect(pipe.x, bottomY, pipe.width, bottomHeight);
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
    const winner = birds.reduce((max, bird) => 
      bird.score > max.score ? bird : max
    , birds[0]);

    ctx.font = "24px Arial";
    ctx.fillStyle = "yellow";
    ctx.fillText(`🏆 ${winner.name} venceu!`, logicalWidth / 2, logicalHeight / 2 - 20);
    ctx.fillStyle = "white";
    ctx.fillText(`${winner.score} pontos`, logicalWidth / 2, logicalHeight / 2 + 10);
  }

  /* ================= LOOP ================= */
  function loop(time: number) {
    if (!lastTime) lastTime = time;

    const delta = time - lastTime;
    lastTime = time;

    accumulator += delta;

    while (accumulator >= FRAME_TIME) {
      update();
      accumulator -= FRAME_TIME;
    }

    draw();

    requestAnimationFrame(loop);
  }

  /* ================= INPUT ================= */
  const handleClick = () => {
    if (!gameOver) {
      socket.emit("flappyBirdFlap");
      playFlap();
    }
  };

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !gameOver) {
      socket.emit("flappyBirdFlap");
      playFlap();
    }
  });

  requestAnimationFrame(loop);

  // Retornar função de cleanup
  return () => {
    document.removeEventListener("click", handleClick);
    socket.off("flappyBirdStarted");
    socket.off("flappyBirdUpdate");
    socket.off("flappyBirdDeath");
    socket.off("flappyBirdGameOver");
  };
}
