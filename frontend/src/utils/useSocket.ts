import { io, Socket } from 'socket.io-client';

// Configura o Socket fora do hook para ser um singleton
// A URL deve ser a do seu backend
const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socketInstance = io(URL, { autoConnect: true });

export const useSocket = (): Socket => {
    return socketInstance;
};
