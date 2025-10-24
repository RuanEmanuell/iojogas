import { useEffect, useRef } from "preact/hooks";
import { io, Socket } from "socket.io-client";
import './app.css';
import { getRandomNumber } from "./utils/getRandomNumber";

export function App() {
  const socket = useRef<Socket>();

  function createGame() {
    if (!socket.current) return;

    const roomId = getRandomNumber(1000, 9999).toString();

    socket.current.emit("createRoom", roomId);

    console.log("🟢 Sala criada:", roomId);
  }

  useEffect(() => {
    socket.current = io("http://localhost:3000");

    socket.current.on("connect", () => {
      console.log("✅ Conectado ao servidor!", socket.current?.id);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, []);

  return (
    <div class="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
      <h1 class="text-6xl font-bold my-4">IOJOGAS 🎮❓</h1>
      <button class="w-64 h-24 bg-green-600 text-3xl font-bold rounded-md cursor-pointer" onClick={createGame}>NOVO JOGO</button>
    </div>
  );
}
