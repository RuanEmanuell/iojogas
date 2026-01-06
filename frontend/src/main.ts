import './style.css'
import { io } from "socket.io-client"
import { Player } from './types/Player'
import { CATEGORIES } from './utils/categories'
import { initFlappyBird } from './flappyBird'

const apiUrl = import.meta.env.VITE_API_URL

const socket = io(apiUrl)

let currentGameMode: 'quiz' | 'flappybird' | null = null
let flappyBirdCleanup: (() => void) | null | undefined = null

// ==========================================================
//  CONEXÃO
// ==========================================================
socket.on("connect", () => {
  const name =
    prompt("Digite seu nome") ||
    `Player${Math.floor(Math.random() * 9999)}`

  socket.emit("createPlayer", name)
})

socket.on("disconnect", () => {
  console.log("Desconectou do servidor!")
})

// ==========================================================
//  ATUALIZAÇÃO DA LISTA DE PLAYERS
// ==========================================================
socket.on("playerListUpdate", (playerList: Player[]) => {
  playerList = playerList.sort((a, b) => (b.score || 0) - (a.score || 0));
  const list = document.querySelector(".playerList") as HTMLElement
  list.replaceChildren()

  for (const p of playerList) {
    list.appendChild(createPlayerElement(p))
  }

  const leader = playerList.find(p => p.leader);
  const hasMinPlayers = playerList.length >= 2;

  if (!leader) {
      document.querySelector("#waiting-game")?.classList.remove("hidden");
  }

  if (leader && leader.id === socket.id && !document.querySelector("#startButton") && !document.querySelector("#game-mode-container")) {

    document.querySelector("#waiting-game")?.classList.add("hidden");

    // Seleção de modo de jogo
    const gameModeContainer = document.createElement("div")
    gameModeContainer.id = "game-mode-container"
    gameModeContainer.classList.add("flex", "flex-col", "gap-4", "mb-6", "items-center")
    gameModeContainer.innerHTML = `
      <h2 class="text-2xl font-bold text-white">Escolha o Jogo</h2>
      <div class="flex gap-4">
        <button id="select-quiz" class="bg-blue-600 hover:bg-blue-800 px-6 py-3 rounded-lg font-bold transition-all">
          Quiz
        </button>
        <button id="select-flappybird" class="bg-purple-600 hover:bg-purple-800 px-6 py-3 rounded-lg font-bold transition-all">
          Flappy Bird
        </button>
      </div>
    `
    document.querySelector("#app")?.appendChild(gameModeContainer)

    document.querySelector("#select-quiz")?.addEventListener("click", () => {
      currentGameMode = 'quiz'
      showQuizConfig()
    })

    document.querySelector("#select-flappybird")?.addEventListener("click", () => {
      currentGameMode = 'flappybird'
      startFlappyBird()
    })

    return
  }

  function showQuizConfig() {
    document.querySelector("#game-mode-container")?.remove()

    const container = document.createElement("div")
    container.id = "quiz-config-container"
    container.classList.add("flex", "flex-col", "gap-4", "mb-4");

    container.innerHTML = `

    <div class="flex flex-col gap-1">
      <label class="text-white font-semibold text-lg">Tempo por pergunta</label>
      <select id="timeInput"
        class="px-4 py-2 rounded bg-gray-900 text-white border border-gray-600 text-lg">
        <option value="10">10 segundos</option>
        <option value="15">15 segundos</option>
        <option value="20" selected>20 segundos</option>
        <option value="30">30 segundos</option>
        <option value="45">45 segundos</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-white font-semibold text-lg">Pontuação para vencer</label>
      <select id="scoreInput"
        class="px-4 py-2 rounded bg-gray-900 text-white border border-gray-600 text-lg">
        <option value="30">30 pontos</option>
        <option value="50">50 pontos</option>
        <option value="75">75 pontos</option>
        <option value="100" selected>100 pontos</option>
        <option value="150">150 pontos</option>
      </select>
    </div>

  `

    document.querySelector("#app")?.appendChild(container)

    const btn = document.createElement("button")
    btn.id = "startButton"
    btn.classList.add(
      "bg-green-600", "rounded-lg", "text-2xl",
      "py-4", "px-6", "font-bold", "cursor-pointer",
      "hover:bg-green-800", "transition-all"
    )
    btn.textContent = "Iniciar"

    btn.onclick = () => {
      const time = Number((document.querySelector("#timeInput") as HTMLSelectElement).value)
      const score = Number((document.querySelector("#scoreInput") as HTMLSelectElement).value)

      socket.emit("startGame", { time, score })
    }

    document.querySelector("#app")?.appendChild(btn)
  } 


  if (document.querySelector("#startButton")) {

    document.querySelector("#startButton")?.addEventListener("click", () => startGame(hasMinPlayers));

    console.log("Jogadores na sala:", playerList.length, " - Habilitar botão?", hasMinPlayers);

    if (hasMinPlayers) {
      document.querySelector("#startButton")?.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      document.querySelector("#startButton")?.classList.add("opacity-50", "cursor-not-allowed");
    }
  }
})

// ==========================================================
//  INÍCIO DO JOGO / TELA DE JOGO
// ==========================================================
socket.on("gameStarted", () => {
  document.querySelector("#app")?.classList.add("hidden")
  document.querySelector("#game")?.classList.remove("hidden")
})

// Nova pergunta
socket.on("changeQuestion", (q) => {
  const imagePath = `/images/${q.imageUrl ?? ""}`
  renderQuestion(imagePath, q.id, q.category)
})

// Timer
socket.on("timerUpdate", (timeLeft: number) => {
  const el = document.querySelector("#countdown")
  if (el) el.textContent = `Tempo restante: ${timeLeft}s`
})

socket.on("timerFinished", ({ correctAnswer }) => {
  showMessage(`Tempo acabou! Resposta correta: ${correctAnswer}`)
  disableAnswerInput(true)
})

// Fim de jogo
socket.on("gameFinished", (playerList: Player[]) => {
  const winner = playerList.reduce(
    (acc, p) => (p.score > (acc?.score ?? -1) ? p : acc),
    null as Player | null
  )

  showMessage(
    `${winner?.name ?? "Alguém"} venceu com ${winner?.score ?? 0} pontos!`
  )

  const gameEl = document.querySelector("#game") as HTMLElement
  gameEl.classList.add("hidden")
  gameEl.innerHTML = ""

  document.querySelector("#app")?.classList.remove("hidden")
})

// Resposta correta/errada
socket.on("correctAnswer", (info) => {
  showMessage("");
  const ans = document.querySelector("#game-answer");
  if (!ans) return;

  ans.classList.remove("bg-white", "text-black");
  ans.classList.add("bg-green-500", "text-white");

  const text = `${info.name} acertou em ${info.time}s: ${info.answer}`
  ans.textContent = text;
  disableAnswerInput(true);
});

socket.on("wrongAnswer", () => {
  showMessage("");
  const ans = document.querySelector("#game-answer");
  if (!ans) return;

  ans.classList.remove("bg-white", "text-black");
  ans.classList.add("bg-red-600", "text-white");
});


socket.on("unlockAnswer", () => {
  disableAnswerInput(false)
})

socket.on("answerReceived", (info) => {
  const old = document.querySelector("#game-answer");
  if (old) old.remove();

  const container = document.getElementById("game-container");

  createAnswerPopup(`${info.playerName}: ${info.text}`, container!);
});


socket.on("showWinner", ({ winner }) => {
  const gameEl = document.querySelector("#game") as HTMLElement;
  gameEl.innerHTML = "";

  const div = document.createElement("div");
  div.classList.add("text-center", "text-3xl", "font-bold", "mt-10");

  div.textContent = `🏆 ${winner.name} venceu com ${winner.score} pontos!`;

  gameEl.appendChild(div);
});

socket.on("returnToLobby", () => {
  const gameEl = document.querySelector("#game") as HTMLElement;
  gameEl.classList.add("hidden");

  const flappyEl = document.querySelector("#flappy-bird-game") as HTMLElement;
  flappyEl.classList.add("hidden");

  if (flappyBirdCleanup) {
    flappyBirdCleanup();
    flappyBirdCleanup = null;
  }

  currentGameMode = null;

  // Limpar todos os elementos de configuração de jogo
  document.querySelector("#game-mode-container")?.remove();
  document.querySelector("#quiz-config-container")?.remove();
  document.querySelector("#startButton")?.remove();

  document.querySelector("#app")?.classList.remove("hidden");
  
  // Forçar uma atualização da lista de jogadores para recriar os controles do líder
  socket.emit("requestPlayerListUpdate");
});

socket.on("initialState", (state) => {
  socket.emit("playerListUpdate", state.playerList)

  if (!state.gameStarted) {
    // Ainda está no lobby
    document.querySelector("#game")?.classList.add("hidden")
    document.querySelector("#app")?.classList.remove("hidden")
    return
  }

  // Já tem jogo rolando → mostrar tela de jogo imediatamente
  document.querySelector("#app")?.classList.add("hidden")
  document.querySelector("#game")?.classList.remove("hidden")

  // Renderiza a pergunta atual
  if (state.currentQuestion) {
    const imagePath = `/images/${state.currentQuestion.imageUrl ?? ""}`
    renderQuestion(
      imagePath,
      state.currentQuestion.id,
      state.currentQuestion.category,
      state.timeLeft
    )
  }

  // Ajusta timer atual
  const el = document.querySelector("#countdown")
  if (el) el.textContent = `Tempo restante: ${state.timeLeft}s`

  // Garante que o player possa responder
  disableAnswerInput(false)
})


// ==========================================================
//  CRIA ELEMENTO DE PLAYER NO LOBBY
// ==========================================================
function createPlayerElement(player: Player): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>("#player-template")!
  const fragment = template.content.cloneNode(true) as DocumentFragment

  const el = fragment.querySelector(".player-item") as HTMLElement
  const nameSpan = el.querySelector(".player-name") as HTMLElement

  if (socket.id === player.id) {
    el.classList.add("bg-green-600")
  }

  const scoreTxt = player.score ? ` — ${player.score} pts` : ""
  nameSpan.textContent = `${player.name}${scoreTxt}`

  if (player.leader) nameSpan.textContent += " 👑"

  return el
}

// ==========================================================
//  START GAME
// ==========================================================
function startGame(hasMinPlayers: boolean) {
  if (hasMinPlayers) {
    document.querySelector("#startButton")?.remove();
  }
}


// ==========================================================
//  RENDERIZA A PERGUNTA
// ==========================================================
function renderQuestion(imageUrl: string, questionId?: number, category?: string, timeLeft?: number) {
  const gameEl = document.querySelector("#game") as HTMLElement
  gameEl.innerHTML = ""

  const container = document.createElement("div")
  container.id = "game-container";
  container.classList.add("flex", "flex-col", "items-center")

  if (questionId !== undefined) container.dataset.questionId = String(questionId);

  const subtitle = document.createElement("div")
  subtitle.classList.add("text-lg", "font-bold", "mb-3");

  subtitle.textContent = CATEGORIES[category ?? ""] || "O que é essa imagem?"

  container.append(subtitle)

  const img = document.createElement("img");
  img.src = imageUrl;

  img.classList.add("w-96", "h-80", "aspect-square", "object-cover", "object-center", "mb-4", "border-2", "border-white", "rounded-lg", "shadow-lg"
  );

  const countdown = document.createElement("div")
  countdown.id = "countdown"
  countdown.classList.add("mb-2", "text-sm")
  countdown.textContent = `Tempo restante: ${timeLeft ?? "s"}s`

  const input = document.createElement("input")
  input.id = "answer-input"
  input.placeholder = "Digite sua resposta...";
  input.classList.add("p-2", "rounded", "w-64", "text-black", "bg-white");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendAnswer()
    }
  })

  const btn = document.createElement("button")
  btn.id = "send-answer-btn"
  btn.textContent = "Enviar"
  btn.classList.add("bg-blue-600", "px-4", "py-2", "rounded", "hover:bg-blue-800", "text-white", "font-bold", "cursor-pointer", "transition-all")
  btn.onclick = sendAnswer

  const row = document.createElement("div")
  row.classList.add("flex", "items-center", "gap-2")
  row.append(input, btn)

  const msg = document.createElement("div")
  msg.id = "game-message"
  msg.classList.add("text-sm", "text-gray-300", "mt-3");

  const answer = document.createElement("div");
  answer.id = "game-answer";

  answer.className = `
    hidden
     mt-3 px-5 py-2
    text-black font-bold text-lg
    rounded-xl shadow-md
    bg-white
    transition-all duration-200
    opacity-0 scale-95
  `;

  container.appendChild(answer);

  requestAnimationFrame(() => {
    answer.classList.remove("opacity-0", "scale-95");
    answer.classList.add("opacity-100", "scale-100");
  });

  container.append(img, countdown, row, msg, answer);
  gameEl.append(container)

  // foca no input e garante desbloqueio
  setTimeout(() => {
    input.focus()
    disableAnswerInput(false) // <<< ESSENCIAL
  }, 30)
}


function sendAnswer() {
  const input = document.querySelector<HTMLInputElement>("#answer-input")
  if (!input) return

  const text = input.value.trim()
  if (!text) return

  showMessage(`Enviando: ${text}`)
  disableAnswerInput(true)

  socket.emit("answer", text)
}


// ==========================================================
//  FUNÇÕES UTILITÁRIAS
// ==========================================================
function showMessage(text: string) {
  const msg = document.querySelector("#game-message") as HTMLElement
  if (msg) msg.textContent = text
}

function createAnswerPopup(text: string, container: HTMLElement) {
  const answer = document.createElement("div");
  answer.id = "game-answer";

  answer.className = `
    inline-block mt-3 px-5 py-2 min-w-[120px]
    text-black font-bold text-lg text-center
    rounded-xl shadow-md
    bg-white
    transition-all duration-200
    opacity-0
  `;

  answer.textContent = text;
  container.appendChild(answer);

  requestAnimationFrame(() => {
    answer.classList.remove("opacity-0");
    answer.classList.add("opacity-100");
  });
}



function disableAnswerInput(disabled: boolean) {
  const input = document.querySelector<HTMLInputElement>("#answer-input")
  const btn = document.querySelector<HTMLButtonElement>("#send-answer-btn")

  if (input) input.disabled = disabled
  if (btn) btn.disabled = disabled
}

// ==========================================================
//  FLAPPY BIRD
// ==========================================================
socket.on("flappyBirdStarted", () => {
  document.querySelector("#app")?.classList.add("hidden")
  document.querySelector("#flappy-bird-game")?.classList.remove("hidden")
})

socket.on("returnToLobby", () => {
  const gameEl = document.querySelector("#game") as HTMLElement;
  gameEl.classList.add("hidden");

  const flappyEl = document.querySelector("#flappy-bird-game") as HTMLElement;
  flappyEl.classList.add("hidden");

  if (flappyBirdCleanup) {
    flappyBirdCleanup();
    flappyBirdCleanup = null;
  }

  document.querySelector("#app")?.classList.remove("hidden");
});

function startFlappyBird() {
  // Remover a seleção de modo de jogo
  document.querySelector("#game-mode-container")?.remove()

  // Enviar evento para o servidor iniciar o jogo
  socket.emit("startFlappyBird")

  // Esconder o lobby e mostrar o jogo Flappy Bird
  document.querySelector("#app")?.classList.add("hidden")
  document.querySelector("#flappy-bird-game")?.classList.remove("hidden")

  // Iniciar o jogo
  flappyBirdCleanup = initFlappyBird(socket, socket.id ?? "")
}
