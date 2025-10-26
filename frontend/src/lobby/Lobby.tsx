// lobby.tsx
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSocket } from "../utils/useSocket";
import { FiveLetters } from "../games/fiveletters/FiveLetters";
import type { Player } from "../types/Player";

export function Lobby() {
    const socket = useSocket();
    const { roomName } = useParams<{ roomName: string }>();
    const location = useLocation();

    const state = location.state as { userName?: string } | null;
    const initialName = state?.userName || "";

    const [userName, setUserName] = useState<string>(initialName);
    const [hasName, setHasName] = useState<boolean>(!!initialName);
    const [players, setPlayers] = useState<Player[]>([]);
    const [copied, setCopied] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [currentGame, setCurrentGame] = useState("");
    const [isRoomAdmin, setIsRoomAdmin] = useState(false);

    const joinedRef = useRef(false);

    // === Função de entrada segura na sala ===
    function enterRoom() {
        if (!socket || !roomName || !userName.trim()) return;

        setHasName(true);

        // ⚡️ Marca antes de emitir para evitar duplicação
        if (!joinedRef.current) {
            joinedRef.current = true;
            socket.emit("joinRoom", roomName, userName);
        }
    }

    // === Função de cópia do link ===
    function copyLink() {
        const url = `${window.location.origin}/lobby/${roomName}`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } else {
            const input = document.createElement('textarea');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function startGame() {
        if (!socket || !roomName) return;
        socket.emit("startGame", roomName);
    }

    // === Efeito para atualizar lista de players e iniciar jogo ===
    useEffect(() => {
        if (!socket || !roomName) return;

        const handlePlayersUpdate = (data: { players: Player[] }) => {
            alert("")
            // Atualiza admin
            const currentPlayer = data.players.find(p => p.id === socket.id);
            if (currentPlayer) setIsRoomAdmin(currentPlayer.roomAdmin);

            // Atualiza lista
            setPlayers(data.players);
        };

        const handleGameStarted = (data: { game: string }) => {
            setGameStarted(true);
            setCurrentGame(data.game);
        };

        // 🚨 NOVO HANDLER PARA A CRIAÇÃO DA SALA (se mantiver o evento no backend)
        const handleRoomCreated = (data: { roomName: string, players: Player[] }) => {
            // O mesmo que handlePlayersUpdate
            handlePlayersUpdate({ players: data.players }); // ✅ Vai atualizar a lista
        };


        socket.on("currentRoomPlayers", handlePlayersUpdate);
        socket.on("playerJoined", handlePlayersUpdate); // Note: 'playerJoined' não é usado no backend, mas 'currentRoomPlayers' é a substituição
        socket.on("gameStarted", handleGameStarted);
        socket.on("roomCreated", handleRoomCreated); // 🚨 Adicione a escuta

        return () => {
            socket.off("currentRoomPlayers", handlePlayersUpdate);
            socket.off("playerJoined", handlePlayersUpdate);
            socket.off("gameStarted", handleGameStarted);
            socket.off("roomCreated", handleRoomCreated); // 🚨 Remova a escuta
        };
    }, [socket, roomName]);


    // === Tela de entrada de nome ===
    if (!hasName) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <h1 className="text-4xl mb-4 font-bold">Sala: {roomName}</h1>
                <h2 className="text-2xl mb-2">Digite seu nome:</h2>
                <input
                    className="bg-gray-800 border border-gray-500 rounded-lg w-72 text-white font-bold text-center p-2 mb-4 focus:outline-none focus:border-green-400"
                    value={userName}
                    onChange={(e) => setUserName(e.currentTarget.value)}
                    maxLength={20}
                />
                <button
                    className="w-64 h-24 bg-green-600 text-3xl font-bold rounded-md cursor-pointer hover:bg-green-700 transition duration-300"
                    onClick={enterRoom}
                    disabled={!userName.trim()}
                >
                    ENTRAR
                </button>
            </div>
        );
    }

    // === Lobby antes do jogo começar ===
    if (!gameStarted) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white p-4">
                <h1 className="text-4xl mb-4 font-extrabold text-green-400">Sala: {roomName}</h1>

                <button
                    className="mb-6 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 font-semibold shadow-md"
                    onClick={copyLink}
                >
                    {copied ? "Link copiado! 🎉" : "Copiar link da sala"}
                </button>

                <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
                    <h2 className="text-2xl mb-4 font-bold border-b border-gray-700 pb-2">
                        Jogadores ({players.length}):
                    </h2>
                    <ul className="space-y-3">
                        {players.map((player) => (
                            <li
                                key={player.id}
                                className="text-xl flex justify-between items-center bg-gray-700 p-3 rounded-md"
                            >
                                <span className="font-medium">
                                    {player.userName}
                                    {player.id === socket?.id && " (Você)"}
                                </span>
                                {player.roomAdmin && (
                                    <span className="text-yellow-400 text-2xl" title="Admin da Sala">👑</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {isRoomAdmin && players.length > 1 && (
                    <button
                        className="w-48 h-16 bg-green-600 text-xl font-bold rounded-xl cursor-pointer my-8 hover:bg-green-700 transition duration-300 shadow-xl"
                        onClick={startGame}
                    >
                        Começar Jogo
                    </button>
                )}
                {isRoomAdmin && players.length <= 1 && (
                    <p className="text-red-400 mt-8 text-lg font-medium">
                        Convide mais jogadores para começar o jogo!
                    </p>
                )}
            </div>
        );
    }

    // === Quando o jogo começa ===
    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
            {currentGame === "FiveLetters" && (
                <FiveLetters socket={socket} roomName={roomName!} />
            )}
        </div>
    );
}
