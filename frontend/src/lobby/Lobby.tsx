import { useState } from "react"

export function Lobby() {

    const [currentPlayers, setCurrentPlayers] = useState<string[]>([]);
    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
            {currentPlayers.map((player, idx) => (
                <h1 key={idx}>{player}</h1>
            ))}
        </div>
    )
}