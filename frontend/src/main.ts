import './style.css'
import { io } from "socket.io-client";
import { Player } from './types/Player';

const apiUrl = import.meta.env.VITE_API_URL;

const socket = io(apiUrl);

function createPlayerElement(player: Player): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>("#player-template")!;
  const fragment = template.content.cloneNode(true) as DocumentFragment;

  const el = fragment.querySelector(".player-item") as HTMLElement;

  if (socket.id === player.id) {
    el.classList.add("bg-green-600");
  }

  const nameSpan = el.querySelector(".player-name") as HTMLElement;

  nameSpan.textContent = player.name;

  if (player.leader) {
    nameSpan.textContent += " 👑";
  }

  return el;
}

socket.on("connect", () => {
  const name = prompt("Digite seu nome") || `Player${Math.floor(Math.random() * 9999)}`;
  socket.emit("createPlayer", name);
});

socket.on("disconnect", () => {
  console.log("Desconectou do servidor!");
});

socket.on("playerListUpdate", (playerList: Player[]) => {
  const list = document.querySelector(".playerList") as HTMLElement;

  list.replaceChildren();

  for (const p of playerList) {
    const el = createPlayerElement(p);
    list.appendChild(el);
  }

  console.log("Lista atualizada:", playerList);

  if (socket.id === playerList.find(item => item.leader === true)?.id && !document.querySelector("#startButton")) {
    const startButton = document.createElement('button');
    startButton.id = "startButton"
    startButton.classList.add("bg-green-600", "rounded-lg", "text-2xl", "py-4", "px-6", "font-bold", "cursor-pointer", "hover:bg-green-800", "transition-all");
    startButton.textContent = "Iniciar";

    document.querySelector("#app")?.appendChild(startButton);
  }
});
