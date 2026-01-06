export function initFlappyBird() {
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

  /* ================= IMAGENS ================= */
  const birdImg = new Image();
  birdImg.src = "/public/bird.png";

  const pipeImg = new Image();
  pipeImg.src = "/public/pipe.png";

  const floorImg = new Image();
  floorImg.src = "/public/floor.png";

  const backgroundImg = new Image();
  backgroundImg.src = "/public/background.png";

  /* ================= SONS ================= */
  const flapSound = new Audio("/public/sounds/flap.mp3");
  const scoreSound = new Audio("/public/sounds/score.mp3");

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

  let floorX = 0;

  let score = 0;
  let isGameOver = false;

  /* ================= BIRD ================= */
  let bird = {
    x: 80,
    y: 150,
    w: 40,
    h: 30,
    vy: 0
  };

  /* ================= PIPE ================= */
  let pipe = {
    x: logicalWidth,
    width: 70,
    gap: 160,
    topHeight: randomPipeHeight()
  };

  /* ================= UTILS ================= */
  function randomPipeHeight() {
    const min = 80;
    const max = groundY - 120 - min;
    return Math.floor(Math.random() * (max - min) + min);
  }

  /* ================= UPDATE ================= */
  function update() {
    if (isGameOver) return;

    floorX -= 2;
    if (floorX <= -logicalWidth) floorX = 0;

    bird.vy += 0.4;
    bird.y += bird.vy;

    pipe.x -= 3 + score * 0.2;
    if (pipe.x + pipe.width < 0) {
      pipe.x = logicalWidth;
      pipe.topHeight = randomPipeHeight();
      score++;
      playScore();
    }

    checkCollision();
  }

  /* ================= DRAW ================= */
  function draw() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    ctx.drawImage(backgroundImg, 0, 0, logicalWidth, logicalHeight);

    drawPipes();

    ctx.drawImage(birdImg, bird.x, bird.y, bird.w, bird.h);

    ctx.drawImage(floorImg, floorX, groundY, logicalWidth + 5, 120);
    ctx.drawImage(floorImg, floorX + logicalWidth, groundY, logicalWidth, 120);

    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const text = `${score}`;
    const x = logicalWidth / 2;
    const y = 40;

    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.strokeText(text, x, y);

    ctx.fillStyle = "orange";
    ctx.fillText(text, x, y);

    if (isGameOver) {
      drawGameOver();
      return;
    }
  }

  /* ================= PIPES ================= */
  function drawPipes() {
    ctx.save();
    ctx.translate(pipe.x, pipe.topHeight);
    ctx.scale(1, -1);
    ctx.drawImage(pipeImg, 0, 0, pipe.width, pipe.topHeight);
    ctx.restore();

    const bottomY = pipe.topHeight + pipe.gap;
    const bottomHeight = groundY - bottomY;

    ctx.drawImage(pipeImg, pipe.x, bottomY, pipe.width, bottomHeight);
  }

  /* ================= COLLISION ================= */
  function rectsCollide(a: any, b: any) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function checkCollision() {
    const topPipe = {
      x: pipe.x,
      y: 0,
      w: pipe.width,
      h: pipe.topHeight
    };

    const bottomPipe = {
      x: pipe.x,
      y: pipe.topHeight + pipe.gap,
      w: pipe.width,
      h: groundY - (pipe.topHeight + pipe.gap)
    };

    if (
      rectsCollide(bird, topPipe) ||
      rectsCollide(bird, bottomPipe) ||
      bird.y + bird.h >= groundY
    ) {
      gameOver();
    }
  }

  /* ================= GAME OVER ================= */
  function gameOver() {
    isGameOver = true;
  }

  function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = "red";
    ctx.font = "48px Arial Black";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", logicalWidth / 2, logicalHeight / 2 - 20);

    ctx.font = "24px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(`Score: ${score} pontos`, logicalWidth / 2, logicalHeight / 2 + 20);
    ctx.fillText("Clique para reiniciar", logicalWidth / 2, logicalHeight / 2 + 50);
  }

  function resetGame() {
    // BIRD
    bird.x = 80;
    bird.y = 150;
    bird.vy = 0;

    // PIPE
    pipe.x = logicalWidth;
    pipe.topHeight = randomPipeHeight();

    // WORLD
    floorX = 0;

    // STATE
    score = 0;
    isGameOver = false;
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
    if (isGameOver) {
      resetGame();
    } else {
      bird.vy = -8;
      playFlap();
    }
  };

  document.addEventListener("click", handleClick);

  requestAnimationFrame(loop);

  // Retornar função de cleanup
  return () => {
    document.removeEventListener("click", handleClick);
  };
}
