import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useSocket } from "../utils/socket";

export function Lobby() {
    const socket = useSocket();
    const { roomName } = useParams<{ roomName: string }>();
    const location = useLocation();

    const state = location.state as { userName?: string } | null;
    const initialName = state?.userName || "";

    const [userName, setUserName] = useState<string>(initialName);
    const [hasName, setHasName] = useState<boolean>(!!initialName);
    const [currentPlayers, setCurrentPlayers] = useState<string[]>([]);

    const joinedRef = useRef(false);

    function enterRoom() {
        if (!socket || !roomName || !userName) return;
        setHasName(true);

        // só entra se ainda não entrou
        if (!joinedRef.current) {
            socket.emit("joinRoom", roomName, userName);
            joinedRef.current = true;
        }
    }

    useEffect(() => {
        if (!socket || !roomName) return;

        // entra automaticamente apenas se tem initialName e ainda não entrou
        if (initialName && !joinedRef.current) {
            setHasName(true);
            socket.emit("joinRoom", roomName, initialName);
            joinedRef.current = true;
        }

        const handleCurrentPlayers = (players: string[]) => {
            setCurrentPlayers(players);
        };

        const handlePlayerJoined = (data: { userName: string }) => {
            setCurrentPlayers(prev => prev.includes(data.userName) ? prev : [...prev, data.userName]);
        };


        socket.on("currentPlayers", handleCurrentPlayers);
        socket.on("playerJoined", handlePlayerJoined);

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

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
            <h1 className="text-4xl mb-4">Sala: {roomName}</h1>
            <h2 className="text-2xl mb-2">Jogadores:</h2>
            {currentPlayers.map((player, idx) => (
                <h3 key={idx}>
                    {player === userName ? `${userName} (Você)` : player}
                </h3>
            ))}
        </div>
    );
}
