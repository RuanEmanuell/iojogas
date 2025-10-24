import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { Lobby } from "./lobby/Lobby";
import { SocketContext } from "./utils/socket";
import { FiveLetters } from "./games/fiveletters/FiveLetters";

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3000");
    setSocket(s);

    s.on("connect", () => {
      console.log("✅ Socket conectado!", s.id);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <Routes>
        <Route path="/" element={<FiveLetters />} />
        <Route path="/lobby/:roomName" element={<Lobby />} />
      </Routes>
    </SocketContext.Provider>
  );
}
