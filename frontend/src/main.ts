import './style.css'
import { io } from "socket.io-client";
import { Player } from './types/Player';

const apiUrl = import.meta.env.VITE_API_URL;

const socket = io(apiUrl);

function createPlayerElement(player: Player): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>("#player-template")!;
  const fragment = template.content.cloneNode(true) as DocumentFragment;

  const el = fragment.querySelector(".player-item") as HTMLElement;
  const nameSpan = el.querySelector(".player-name") as HTMLElement;

  nameSpan.textContent = player.name;

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
});
