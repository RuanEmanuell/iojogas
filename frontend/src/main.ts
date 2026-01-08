import './style.css'
import { io } from "socket.io-client"
import { Player } from './types/Player'
import { CATEGORIES } from './utils/categories'
import { initFlappyBird } from './flappyBird'

const apiUrl = import.meta.env.VITE_API_URL

const socket = io(apiUrl)

let flappyBirdCleanup: (() => void) | undefined | null = null
let playerListCache: Player[] = []


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
  playerListCache = [...playerList]
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
    gameModeContainer.classList.add("flex", "flex-col", "gap-4", "mb-6", "items-center", "w-full", "max-w-md")
    gameModeContainer.innerHTML = `
      <h2 class="text-3xl font-bold text-white mb-4">Escolha o Jogo</h2>
      <button id="select-quiz" class="w-full bg-blue-600 hover:bg-blue-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🎯 Quiz
      </button>
      <button id="select-flappybird" class="w-full bg-purple-600 hover:bg-purple-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🐦 Flappy Bird
      </button>
      <button id="select-impostor" class="w-full bg-red-600 hover:bg-red-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🕵️ Impostor
      </button>
    `
    document.querySelector("#app")?.appendChild(gameModeContainer)

    document.querySelector("#select-quiz")?.addEventListener("click", () => {
      showQuizConfig()
    })

    document.querySelector("#select-flappybird")?.addEventListener("click", () => {
      startFlappyBird()
    })

    document.querySelector("#select-impostor")?.addEventListener("click", () => {
      startImpostor()
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
  gameEl.classList.remove("flex");

  const flappyEl = document.querySelector("#flappy-bird-game") as HTMLElement;
  flappyEl.classList.add("hidden");

   // Impostor cleanup
  if (impostorUI.container) {
    showImpostorUI(false)
    impostorUI.container.remove()
    impostorUI.container = null
  }

  if (flappyBirdCleanup) {
    flappyBirdCleanup();
    flappyBirdCleanup = null;
  }

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
//  IMPOSTOR GAME
// ==========================================================
type ImpostorRole = "impostor" | "crew"
type ImpostorPhase = "discussion" | "vote"

const impostorUI = {
  container: null as HTMLElement | null,
  role: null as HTMLElement | null,
  word: null as HTMLElement | null,
  phase: null as HTMLElement | null,
  timer: null as HTMLElement | null,
  status: null as HTMLElement | null,
  aliveList: null as HTMLElement | null,
  voteList: null as HTMLElement | null,
  round: null as HTMLElement | null,
  currentPhase: null as ImpostorPhase | null,
  hasVoted: false
}

function ensureImpostorUI() {
  if (impostorUI.container) return

  const div = document.createElement("div")
  div.id = "impostor-game"
  div.className = "hidden text-white flex flex-col items-center justify-center gap-6 p-8 w-full h-full"

  div.innerHTML = `
    <div class="bg-gray-700 rounded-xl p-6 max-w-2xl w-full shadow-2xl">
      <h2 class="text-4xl font-bold text-center mb-4">🕵️ Impostor</h2>
      <div class="bg-gray-800 rounded-lg p-4 mb-4">
        <div class="text-center text-xl mb-2" id="impostor-round">Rodada 1</div>
        <div class="text-center text-2xl font-bold mb-2" id="impostor-role"></div>
        <div class="text-center text-3xl font-bold text-yellow-400 mb-2" id="impostor-word"></div>
      </div>
      <div class="bg-gray-800 rounded-lg p-4 mb-4">
        <div class="text-center text-lg mb-1" id="impostor-phase"></div>
        <div class="text-center text-2xl font-bold text-green-400" id="impostor-timer"></div>
      </div>
      <div class="bg-gray-800 rounded-lg p-4 mb-4">
        <div class="font-semibold mb-2 text-center">Jogadores vivos</div>
        <div id="impostor-alive" class="flex flex-wrap gap-2 justify-center"></div>
      </div>
      <div id="vote-section" class="bg-gray-800 rounded-lg p-4">
        <div class="font-semibold mb-3 text-center text-lg">Votar para eliminar</div>
        <div id="impostor-vote" class="flex flex-wrap gap-2 justify-center"></div>
      </div>
      <div id="impostor-status" class="text-center text-yellow-300 mt-4 font-semibold"></div>
    </div>
  `

  const gameContainer = document.querySelector("#game")
  if (gameContainer) {
    gameContainer.appendChild(div)
  }

  impostorUI.container = div
  impostorUI.role = div.querySelector("#impostor-role")
  impostorUI.word = div.querySelector("#impostor-word")
  impostorUI.phase = div.querySelector("#impostor-phase")
  impostorUI.timer = div.querySelector("#impostor-timer")
  impostorUI.status = div.querySelector("#impostor-status")
  impostorUI.aliveList = div.querySelector("#impostor-alive")
  impostorUI.voteList = div.querySelector("#impostor-vote")
  impostorUI.round = div.querySelector("#impostor-round")
}

function showImpostorUI(show: boolean) {
  if (!impostorUI.container) ensureImpostorUI();
  if (!impostorUI.container) return;

  if (show) {
    impostorUI.container.classList.remove("hidden");
    impostorUI.container.classList.add("flex");
  } else {
    impostorUI.container.classList.add("hidden");
    impostorUI.container.classList.remove("flex");
  }
}

function updateImpostorAlive(players: string[]) {
  if (!impostorUI.aliveList) return
  impostorUI.aliveList.replaceChildren()
  players.forEach(id => {
    const span = document.createElement("span")
    span.className = "px-4 py-2 bg-green-600 text-white rounded-lg font-semibold shadow"
    const player = playerListCache.find(p => p.id === id)
    span.textContent = player ? player.name : id
    if (id === socket.id) {
      span.classList.add("ring-2", "ring-yellow-400")
    }
    impostorUI.aliveList?.appendChild(span)
  })
}

function renderImpostorVoteButtons(alive: string[]) {
  if (!impostorUI.voteList) return
  impostorUI.voteList.replaceChildren()

  const voteSection = document.querySelector("#vote-section")
  if (!voteSection) return

  alive.forEach(id => {
    if (id === socket.id) return
    const btn = document.createElement("button")
    const player = playerListCache.find(p => p.id === id)
    btn.textContent = player ? player.name : id
    btn.className = "px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-all font-bold shadow-lg hover:scale-105"
    
    // Desabilita se já votou ou não está na fase de votação
    if (impostorUI.hasVoted || impostorUI.currentPhase !== "vote") {
      btn.disabled = true
      btn.classList.add("opacity-50", "cursor-not-allowed")
    }
    
    btn.onclick = () => {
      // Verificação extra antes de enviar o voto
      if (impostorUI.currentPhase !== "vote" || impostorUI.hasVoted) {
        if (impostorUI.status) impostorUI.status.textContent = "❌ Não é possível votar agora!"
        return
      }
      
      socket.emit("impostorVote", { targetId: id })
      impostorUI.hasVoted = true
      if (impostorUI.status) impostorUI.status.textContent = `✅ Voto enviado para ${btn.textContent}`
      
      // Desabilita todos os botões após votar
      const allBtns = impostorUI.voteList?.querySelectorAll("button")
      allBtns?.forEach(b => {
        (b as HTMLButtonElement).disabled = true
        b.classList.add("opacity-50", "cursor-not-allowed")
      })
    }
    impostorUI.voteList?.appendChild(btn)
  })
}

socket.on("impostorGameStarted", (data: { role: ImpostorRole, word: string | null, alive: string[], phase: ImpostorPhase, timeLeft: number, round: number }) => {
  // Esconde outras telas
  document.querySelector("#app")?.classList.add("hidden")
  document.querySelector("#flappy-bird-game")?.classList.add("hidden")
  
  // Mostra a tela de jogo
  const gameEl = document.querySelector("#game")
  gameEl?.classList.remove("hidden")
  gameEl?.classList.add("flex")
  
  // Limpa conteúdo anterior
  if (gameEl) gameEl.innerHTML = ""
  
  // Cria UI do impostor
  ensureImpostorUI()
  showImpostorUI(true)

  // Atualiza fase atual e reseta voto
  impostorUI.currentPhase = data.phase
  impostorUI.hasVoted = false

  if (impostorUI.role) impostorUI.role.textContent = data.role === "impostor" ? "🔪 Você é o Impostor" : "✅ Você é da Tripulação"
  if (impostorUI.word) impostorUI.word.textContent = data.word ? `Palavra: ${data.word}` : "❓ Você não sabe a palavra"
  if (impostorUI.phase) impostorUI.phase.textContent = `Fase: ${data.phase === "discussion" ? "Discussão" : "Votação"}`
  if (impostorUI.timer) impostorUI.timer.textContent = `⏱️ ${data.timeLeft}s`
  if (impostorUI.round) impostorUI.round.textContent = `Rodada ${data.round}`
  updateImpostorAlive(data.alive)
  
  // Esconde seção de voto durante discussão
  const voteSection = document.querySelector("#vote-section") as HTMLElement
  if (voteSection) voteSection.style.display = data.phase === "discussion" ? "none" : "block"
  
  if (data.phase !== "discussion") {
    renderImpostorVoteButtons(data.alive)
  }
  
  if (impostorUI.status) impostorUI.status.textContent = data.phase === "discussion" ? "💬 Discussão em andamento..." : "🗳️ Hora de votar!"
})

socket.on("impostorRound", (data: { role: ImpostorRole, word: string | null, alive: string[], phase: ImpostorPhase, timeLeft: number, round: number }) => {
  ensureImpostorUI()
  showImpostorUI(true)

  // Atualiza fase e reseta voto para nova rodada
  impostorUI.currentPhase = data.phase
  impostorUI.hasVoted = false

  if (impostorUI.role) impostorUI.role.textContent = data.role === "impostor" ? "🔪 Você é o Impostor" : "✅ Você é da Tripulação"
  if (impostorUI.word) impostorUI.word.textContent = data.word ? `Palavra: ${data.word}` : "❓ Você não sabe a palavra"
  if (impostorUI.phase) impostorUI.phase.textContent = `Fase: ${data.phase === "discussion" ? "Discussão" : "Votação"}`
  if (impostorUI.timer) impostorUI.timer.textContent = `⏱️ ${data.timeLeft}s`
  if (impostorUI.round) impostorUI.round.textContent = `Rodada ${data.round}`
  updateImpostorAlive(data.alive)
  
  // Esconde seção de voto durante discussão
  const voteSection = document.querySelector("#vote-section") as HTMLElement
  if (voteSection) voteSection.style.display = data.phase === "discussion" ? "none" : "block"
  
  if (data.phase !== "discussion") {
    renderImpostorVoteButtons(data.alive)
  }
  
  if (impostorUI.status) impostorUI.status.textContent = data.phase === "discussion" ? "💬 Discussão em andamento..." : "🗳️ Hora de votar!"
})

socket.on("impostorTimer", (data: { phase: ImpostorPhase, timeLeft: number, round: number, alive: string[] }) => {
  if (impostorUI.timer) impostorUI.timer.textContent = `⏱️ ${data.timeLeft}s`
  if (impostorUI.phase) impostorUI.phase.textContent = `Fase: ${data.phase === "discussion" ? "Discussão" : "Votação"}`
  if (impostorUI.round) impostorUI.round.textContent = `Rodada ${data.round}`
  updateImpostorAlive(data.alive)
})

socket.on("impostorVoteStart", (data: { timeLeft: number, alive: string[], round: number }) => {
  // Atualiza fase para votação e reseta voto
  impostorUI.currentPhase = "vote"
  impostorUI.hasVoted = false
  
  if (impostorUI.phase) impostorUI.phase.textContent = "Fase: Votação"
  if (impostorUI.timer) impostorUI.timer.textContent = `⏱️ ${data.timeLeft}s`
  if (impostorUI.round) impostorUI.round.textContent = `Rodada ${data.round}`
  if (impostorUI.status) impostorUI.status.textContent = "🗳️ Hora de votar!"
  
  // Mostra seção de voto
  const voteSection = document.querySelector("#vote-section") as HTMLElement
  if (voteSection) voteSection.style.display = "block"
  
  updateImpostorAlive(data.alive)
  renderImpostorVoteButtons(data.alive)
})

socket.on("impostorVoteResult", (data: { eliminated: string | null, tie: boolean, alive: string[], round: number }) => {
  // Remove fase de votação
  impostorUI.currentPhase = null
  
  const voteSection = document.querySelector("#vote-section") as HTMLElement
  if (voteSection) voteSection.style.display = "none"
  
  if (data.tie) {
    if (impostorUI.status) impostorUI.status.textContent = "⚖️ Empate! Ninguém foi eliminado."
  } else if (data.eliminated) {
    const player = playerListCache.find(p => p.id === data.eliminated)
    if (impostorUI.status) impostorUI.status.textContent = `💀 ${player?.name || "Jogador"} foi eliminado!`
  } else {
    if (impostorUI.status) impostorUI.status.textContent = "❌ Nenhum voto foi registrado."
  }
  
  updateImpostorAlive(data.alive)
})

socket.on("impostorGameOver", (data: { winner: "crew" | "impostor", impostorId: string | null, word: string | null }) => {
  const impostor = playerListCache.find(p => p.id === data.impostorId)
  const impostorName = impostor?.name || "Desconhecido"
  
  if (impostorUI.container) {
    impostorUI.container.innerHTML = `
      <div class="bg-gray-700 rounded-xl p-8 max-w-2xl w-full shadow-2xl text-center">
        <h2 class="text-5xl font-bold mb-6">${data.winner === "crew" ? "👥 Tripulação Venceu!" : "🔪 Impostor Venceu!"}</h2>
        <div class="bg-gray-800 rounded-lg p-6 mb-4">
          <p class="text-2xl mb-2">O impostor era:</p>
          <p class="text-3xl font-bold text-red-400 mb-4">${impostorName}</p>
          ${data.word ? `<p class="text-xl">Palavra secreta: <span class="font-bold text-yellow-400">${data.word}</span></p>` : ""}
        </div>
        <p class="text-xl text-gray-300">Voltando ao lobby...</p>
      </div>
    `
  }
})

socket.on("impostorVoteAck", ({ targetId }: { targetId: string }) => {
  const player = playerListCache.find(p => p.id === targetId)
  if (impostorUI.status) impostorUI.status.textContent = `Voto confirmado em ${player?.name || targetId}`
})

socket.on("impostorError", ({ message }: { message: string }) => {
  alert(message)
  // Quando há erro, recriar o menu de seleção de jogos
  const leader = playerListCache.find(p => p.leader);
  
  if (leader && leader.id === socket.id && !document.querySelector("#game-mode-container")) {
    // Recria o menu
    const gameModeContainer = document.createElement("div")
    gameModeContainer.id = "game-mode-container"
    gameModeContainer.classList.add("flex", "flex-col", "gap-4", "mb-6", "items-center", "w-full", "max-w-md")
    gameModeContainer.innerHTML = `
      <h2 class="text-3xl font-bold text-white mb-4">Escolha o Jogo</h2>
      <button id="select-quiz" class="w-full bg-blue-600 hover:bg-blue-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🎯 Quiz
      </button>
      <button id="select-flappybird" class="w-full bg-purple-600 hover:bg-purple-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🐦 Flappy Bird
      </button>
      <button id="select-impostor" class="w-full bg-red-600 hover:bg-red-800 px-8 py-6 rounded-xl font-bold text-2xl transition-all shadow-lg hover:scale-105">
        🕵️ Impostor
      </button>
    `
    document.querySelector("#app")?.appendChild(gameModeContainer)

    document.querySelector("#select-quiz")?.addEventListener("click", () => {
      // showQuizConfig()
    })

    document.querySelector("#select-flappybird")?.addEventListener("click", () => {
      startFlappyBird()
    })

    document.querySelector("#select-impostor")?.addEventListener("click", () => {
      startImpostor()
    })
  }
})

function startImpostor() {
  socket.emit("startImpostorGame")
}

// ==========================================================
//  FLAPPY BIRD
// ==========================================================
socket.on("flappyBirdStarted", (data: { birds: Array<any>, pipe: any }) => {
  // Cleanup da instância anterior se existir
  if (flappyBirdCleanup) {
    flappyBirdCleanup();
    flappyBirdCleanup = null;
  }

  // Garantir que a div do flappy bird existe
  let flappyEl = document.querySelector("#flappy-bird-game") as HTMLElement;
  if (!flappyEl) {
    flappyEl = document.createElement("div");
    flappyEl.id = "flappy-bird-game";
    flappyEl.innerHTML = '<canvas id="canvas"></canvas>';
    document.body.appendChild(flappyEl);
  }

  // Esconder lobby e mostrar o jogo
  document.querySelector("#app")?.classList.add("hidden")
  flappyEl.classList.remove("hidden")
  
  // Inicializar o jogo para TODOS os clientes com dados iniciais
  flappyBirdCleanup = initFlappyBird(socket, socket.id ?? "", data)
})

function startFlappyBird() {
  // Remover a seleção de modo de jogo
  document.querySelector("#game-mode-container")?.remove()

  // Enviar evento para o servidor iniciar o jogo
  socket.emit("startFlappyBird")

  // O jogo será mostrado quando receber o evento flappyBirdStarted do servidor
}
