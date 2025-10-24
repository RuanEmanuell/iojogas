import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Routes, Route, useNavigate } from "react-router-dom";
import { getRandomNumber } from "../utils/getRandomNumber";
import { Lobby } from '../lobby/Lobby';

export function Home() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const socket = useRef<Socket | null>(null);

  function createGame() {
    if (!socket.current) return;

    const roomId = getRandomNumber(1000, 9999).toString();
    socket.current.emit("createRoom", roomId);

    socket.current.on("roomCreated", ({ roomName }) => {
      navigate(`/lobby/${roomName}`);
    });
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
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
      <h1 className="text-6xl font-bold my-4">IOJOGAS 🎮❓</h1>
      <h1>Digite seu nome:</h1>
      <input
        className="bg-transparent border border-gray-500 rounded-sm w-72 text-white font-bold text-center p-2 mb-4 focus:outline-none focus:border-green-400"
        value={userName}
        onChange={(e) => setUserName(e.currentTarget.value)}
        maxLength={20}
      />
      <button
        className="w-64 h-24 bg-green-600 text-3xl font-bold rounded-md cursor-pointer"
        onClick={createGame}
      >
        NOVO JOGO
      </button>
    </div>
  );
}