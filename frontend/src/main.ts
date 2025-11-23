import './style.css'
import { io } from "socket.io-client"
import { Player } from './types/Player'
import { CATEGORIES } from './utils/category'

const apiUrl = import.meta.env.VITE_API_URL

const socket = io(apiUrl)

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

  if (leader && leader.id === socket.id && !document.querySelector("#startButton")) {
    const btn = document.createElement("button")
    btn.id = "startButton"
    btn.classList.add(
      "bg-green-600", "rounded-lg", "text-2xl",
      "py-4", "px-6", "font-bold", "cursor-pointer",
      "hover:bg-green-800", "transition-all"
    )

    btn.textContent = "Iniciar"

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
  showMessage(`${info.name} acertou em ${info.time}s: ${info.answer}`)
  disableAnswerInput(true)
})

socket.on("wrongAnswer", (info) => {
  showMessage(`Errou: ${info.text}`)
});

socket.on("unlockAnswer", () => {
  disableAnswerInput(false)
})

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

  document.querySelector("#app")?.classList.remove("hidden");
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
      state.currentQuestion.category
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
    socket.emit("startGame")
    document.querySelector("#startButton")?.remove();
  }
}

// ==========================================================
//  RENDERIZA A PERGUNTA
// ==========================================================
function renderQuestion(imageUrl: string, questionId?: number, category?: string) {
  const gameEl = document.querySelector("#game") as HTMLElement
  gameEl.innerHTML = ""

  const container = document.createElement("div")
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
  countdown.textContent = "Tempo restante: 20s"

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
  msg.classList.add("text-sm", "text-gray-300", "mt-3")

  container.append(img, countdown, row, msg)
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

function disableAnswerInput(disabled: boolean) {
  const input = document.querySelector<HTMLInputElement>("#answer-input")
  const btn = document.querySelector<HTMLButtonElement>("#send-answer-btn")

  if (input) input.disabled = disabled
  if (btn) btn.disabled = disabled
}
