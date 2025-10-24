import './app.css';
import { Route, Routes } from 'react-router-dom';
import { Lobby } from "./lobby/Lobby";
import { Home } from './home/Home';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby/:roomName" element={<Lobby />} />
    </Routes>
  );
}