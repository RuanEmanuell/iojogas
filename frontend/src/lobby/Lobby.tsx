import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSocket } from "../utils/socket";
import { getRandomNumber } from "../utils/getRandomNumber";
import { FiveLetters } from "../games/fiveletters/FiveLetters";

export function Lobby() {
    const socket = useSocket();
    const { roomName } = useParams<{ roomName: string }>();
    const location = useLocation();

    const state = location.state as { userName?: string } | null;
    const initialName = state?.userName || "";

    const [userName, setUserName] = useState<string>(initialName);
    const [hasName, setHasName] = useState<boolean>(!!initialName);
    const [currentPlayers, setCurrentPlayers] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [currentGame, setCurrentGame] = useState("");

    const availableGames = ["FiveLetters"];

    const joinedRef = useRef(false);

    function enterRoom() {
        if (!socket || !roomName || !userName) return;
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
        if (!socket || !roomName || !userName) return;

        socket.emit("startGame", roomName);
    }

    useEffect(() => {
        if (!socket || !roomName) return;

        if (initialName && !joinedRef.current) {
            setHasName(true);
            socket.emit("joinRoom", roomName, initialName);
            joinedRef.current = true;
        }

        const handleCurrentPlayers = (players: string[]) => setCurrentPlayers(players);

        const handlePlayerJoined = (data: { userName: string }) => {
            setCurrentPlayers(prev => prev.includes(data.userName) ? prev : [...prev, data.userName]);
        };

        const handleGameStarted = (data: { game: string, players: string[] }) => {
            setGameStarted(true);
            alert(availableGames[availableGames.indexOf(data.game)])
            setCurrentGame(availableGames[availableGames.indexOf(data.game)]);
        }

        socket.on("currentPlayers", handleCurrentPlayers);
        socket.on("playerJoined", handlePlayerJoined);
        socket.on("gameStarted", handleGameStarted);

        return () => {
            socket.off("currentPlayers", handleCurrentPlayers);
            socket.off("playerJoined", handlePlayerJoined);
        };
    }, [socket, roomName, initialName]);

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

    if (!gameStarted && currentGame === "") {
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
                {currentPlayers.map((player, idx) => (
                    <h3 key={idx}>
                        {player === userName ? `${userName} (Você)` : player}
                    </h3>
                ))}

                <button
                    className="w-32 h-16 bg-green-600 text-2xl font-bold rounded-md cursor-pointer my-4"
                    onClick={startGame}
                >
                    Começar
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
            {currentGame === "FiveLetters" && <FiveLetters></FiveLetters>}
        </div>
    );
}
