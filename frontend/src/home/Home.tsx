import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRandomNumber } from "../utils/getRandomNumber";
import { useSocket } from "../utils/socket";

export function Home() {
  const navigate = useNavigate();
  const socket = useSocket();

  const [userName, setUserName] = useState("");
  const [isSocketReady, setIsSocketReady] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Quando o socket conecta, marca como pronto
    const handleConnect = () => {
      console.log("✅ Socket conectado no Home:", socket.id);
      setIsSocketReady(true);
    };

    // Quando o servidor confirma a criação da sala
    const handleRoomCreated = ({ roomName }: { roomName: string }) => {
      navigate(`/lobby/${roomName}`, { state: { userName } });
    };

    socket.on("connect", handleConnect);
    socket.on("roomCreated", handleRoomCreated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("roomCreated", handleRoomCreated);
    };
  }, [socket, navigate, userName]);

  // Criar nova sala
  function createGame() {
    if (!socket || !userName.trim()) return;

    const roomId = getRandomNumber(1000, 9999).toString();
    socket.emit("createRoom", roomId, userName);
  }

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
        className="w-64 h-24 bg-green-600 text-3xl font-bold rounded-md cursor-pointer hover:bg-green-700 transition-colors"
        onClick={createGame}
        disabled={!isSocketReady}
      >
        NOVO JOGO
      </button>

      {!isSocketReady && (
        <p className="mt-4 text-red-500">Conectando ao servidor...</p>
      )}
    </div>
  );
}
