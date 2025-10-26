import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSocket } from "../utils/socket";
import { FiveLetters } from "../games/fiveletters/FiveLetters";
import type { Player } from "./types/Player";

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

    function enterRoom() {
        if (!socket || !roomName || !userName.trim()) return;
        setHasName(true);

        if (!joinedRef.current) {
            socket.emit("joinRoom", roomName, userName);
            joinedRef.current = true;
        }
    }

    function copyLink() {
        const url = `${window.location.origin}/lobby/${roomName}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function startGame() {
        if (!socket || !roomName) return;
        socket.emit("startGame", roomName);
    }

    useEffect(() => {
        if (!socket || !roomName) return;

        if (initialName && !joinedRef.current) {
            setHasName(true);
            socket.emit("joinRoom", roomName, initialName);
            joinedRef.current = true;
        }

        const handleCurrentRoomPlayers = (data: { players: Player[] }) => {
            // Atualiza todos os jogadores da sala
            setIsRoomAdmin(data.players.filter(player => player.id === socket?.id)[0].roomAdmin);
            setPlayers(data.players);
        };

        const handlePlayerJoined = (data: Player) => {
            setPlayers((prev) => {
                // evita duplicata
                if (prev.some((p) => p.id === data.id)) return prev;
                return [...prev, data];
            });
        };

        const handleGameStarted = (data: { game: string }) => {
            setGameStarted(true);
            setCurrentGame(data.game);
        };

        socket.on("currentRoomPlayers", handleCurrentRoomPlayers);
        socket.on("playerJoined", handlePlayerJoined);
        socket.on("gameStarted", handleGameStarted);

        return () => {
            socket.off("currentRoomPlayers", handleCurrentRoomPlayers);
            socket.off("playerJoined", handlePlayerJoined);
            socket.off("gameStarted", handleGameStarted);
        };
    }, [socket, roomName, initialName]);

    // === Tela de entrada do nome ===
    if (!hasName) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <h1 className="text-4xl mb-4">Sala: {roomName}</h1>
                <h2 className="text-2xl mb-2">Digite seu nome:</h2>
                <input
                    className="bg-transparent border border-gray-500 rounded-sm w-72 text-white font-bold text-center p-2 mb-4 focus:outline-none focus:border-green-400"
                    value={userName}
                    onChange={(e) => setUserName(e.currentTarget.value)}
                    maxLength={20}
                />
                <button
                    className="w-64 h-24 bg-green-600 text-3xl font-bold rounded-md cursor-pointer"
                    onClick={enterRoom}
                >
                    ENTRAR
                </button>
            </div>
        );
    }

    // === Lobby (antes de começar o jogo) ===
    if (!gameStarted) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <h1 className="text-4xl mb-4">Sala: {roomName}</h1>

                <button
                    className="mb-4 px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
                    onClick={copyLink}
                >
                    {copied ? "Link copiado!" : "Copiar link da sala"}
                </button>

                <h2 className="text-2xl mb-2">Jogadores:</h2>
                {players.map((player) => (
                    <h3 key={player.id}>
                        {player.id === socket?.id ? (
                            <>
                                {player.userName} (Você)
                                {player.roomAdmin && " 👑"}
                            </>
                        ) : (
                            <>
                                {player.userName}
                                {player.roomAdmin && " 👑"}
                            </>
                        )}
                    </h3>
                ))}

                {isRoomAdmin && <button
                    className="w-32 h-16 bg-green-600 text-2xl font-bold rounded-md cursor-pointer my-4"
                    onClick={startGame}
                >
                    Começar
                </button>}
            </div>
        );
    }

    // === Quando o jogo começar ===
    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
            {currentGame === "FiveLetters" && <FiveLetters />}
        </div>
    );
}
