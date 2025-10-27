import { io, Socket } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socketInstance = io(URL, { autoConnect: true });

export const useSocket = (): Socket => {
    return socketInstance;
};
