import './style.css'
import { io } from "socket.io-client";
import { Player } from './types/Player';

const apiUrl = import.meta.env.VITE_API_URL;

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

const socket = io(apiUrl);

socket.on("connect", () => {
  let playerName = prompt("Digite seu nome") || "Player" + getRandomInt(9999);
  socket.emit("createPlayer", playerName);
});

socket.on("disconnect", () => {
  console.log("Desconectou do servidor!");
});

socket.on("playerListUpdate", (playerList: Player[]) => {
  let playerListDiv = document.querySelector(".playerList");
  playerListDiv!.innerHTML = "";

  for (let item of playerList) {
    let playerDiv = document.createElement("div");
    playerDiv.innerHTML = `${item.name}`

    playerListDiv?.appendChild(playerDiv);
  }
  

  console.log("Lista atualizada:", playerList);
});
