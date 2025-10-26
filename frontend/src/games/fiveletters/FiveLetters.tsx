import { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import type { GameState, PlayerDisplay } from "../../types/GameState";
import { EndGameModal } from "./components/EndGameModal";

interface FiveLettersProps {
    socket: Socket;
    roomName: string;
}

export function FiveLetters({ socket, roomName }: FiveLettersProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [guessWord, setGuessWord] = useState("");
    const [guessError, setGuessError] = useState("");

    // O ID do jogador atual para saber se é a nossa vez
    const myPlayerId = socket.id;

    // Processa o estado do jogo para a exibição
    const processedPlayers = useMemo<PlayerDisplay[]>(() => {
        if (!gameState) return [];

        return Object.keys(gameState.players).map(id => {
            const player = gameState.players[id];
            return {
                id,
                name: player.name,
                guesses: player.guesses,
                score: player.score,
                isCurrentPlayer: id === gameState.currentPlayerId
            };
        });
    }, [gameState]);

    // O jogador que está jogando no momento
    const currentPlayerDisplay = processedPlayers.find(p => p.isCurrentPlayer);
    
    // O meu estado no jogo
    const myState = processedPlayers.find(p => p.id === myPlayerId);

    // Se o jogo acabou, quem ganhou
    const winnerDisplay = gameState?.winnerId 
        ? processedPlayers.find(p => p.id === gameState.winnerId) 
        : null;

    // Se é a vez deste jogador
    const isMyTurn = myPlayerId === gameState?.currentPlayerId;
    const wordLength = gameState?.wordLength || 6;
    
    // Placar para o modal de fim de jogo
    const scoreboard = processedPlayers.map(p => ({ name: p.name, score: p.score }));

    // ===================================
    // SOCKET LISTENERS
    // ===================================

    useEffect(() => {
        if (!socket) return;

        // 1. Recebe o estado do jogo do servidor
        const handleFiveLettersUpdate = (data: { currentGameState: GameState }) => {
            setGameState(data.currentGameState);
            setGuessError(""); // Limpa erro ao receber novo estado
        };

        // 2. Recebe erros de palpite (por exemplo, "Não é sua vez")
        const handleGuessError = (data: { message: string }) => {
            setGuessError(data.message);
        };
        
        // 3. Fim de jogo é tratado pela atualização do estado (gameState.gameOver)
        // Mas mantemos o listener do "gameOver" por segurança
        const handleGameOver = (data: { winnerId: string, secretWord: string }) => {
            console.log(`Jogo finalizado. Palavra secreta: ${data.secretWord}`);
        };


        socket.on("fiveLettersUpdate", handleFiveLettersUpdate);
        socket.on("guessError", handleGuessError);
        socket.on("gameOver", handleGameOver); // O modal usa o gameState

        return () => {
            socket.off("fiveLettersUpdate", handleFiveLettersUpdate);
            socket.off("guessError", handleGuessError);
            socket.off("gameOver", handleGameOver);
        };
    }, [socket]);

    // ===================================
    // AÇÕES DO JOGADOR
    // ===================================

    function submitGuessToServer() {
        if (!gameState || !isMyTurn || guessWord.length !== wordLength) {
            setGuessError(isMyTurn ? `A palavra deve ter ${wordLength} letras.` : "Aguarde seu turno.");
            return;
        }

        // 🚨 NOVO: Envia o palpite para o servidor
        socket.emit("submitGuess", roomName, guessWord.toUpperCase());
        setGuessWord("");
    }

    function restartGame() {
        // Apenas o admin pode reiniciar (se o backend verificar a permissão)
        // Por enquanto, apenas um placeholder:
        // socket.emit('restartGame', roomName);
        console.log("Reiniciando jogo (implementação no backend pendente).");
    }

    // ===================================
    // RENDERIZAÇÃO
    // ===================================

    // Funções de estilo
    const getCellClasses = (cell: number) => {
        switch (cell) {
            case 1: return 'bg-green-500 border-white rotate-y-360'; // Correto (Verde)
            case 2: return 'bg-gray-500 border-white';                  // Errado (Cinza, usei gray-500 para ser menos agressivo que red)
            case 3: return 'bg-yellow-400 border-white';               // Misplaced (Amarelo)
            default: return 'bg-[#0D1117] border-gray-700';                       
        }
    }

    if (!gameState) {
        return <div className="text-white text-2xl">Aguardando início do jogo...</div>;
    }

    return (
        <div className="bg-[#0D1117] min-h-screen min-w-screen flex flex-col justify-center items-center p-4 relative">
            
            {/* Mensagem de Erro/Status */}
            {guessError && (
                <div className="absolute top-4 bg-red-600 p-2 rounded-lg text-white font-bold animate-pulse">
                    {guessError}
                </div>
            )}

            {/* Placar Lateral para Desktop */}
            <div className="hidden lg:block absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-800 p-4 rounded-xl shadow-2xl">
                <h3 className="text-xl font-bold mb-3 text-white border-b border-gray-700 pb-1">Placar</h3>
                <ul className="space-y-2">
                    {processedPlayers.sort((a, b) => b.score - a.score).map(p => (
                        <li key={p.id} className={`text-lg font-semibold ${p.isCurrentPlayer ? 'text-green-400' : 'text-gray-300'}`}>
                            {p.name}: {p.score} pts
                        </li>
                    ))}
                </ul>
            </div>


            {/* ===================================
                INFORMAÇÕES E JOGO PRINCIPAL
            ==================================== */}
            <div className="flex flex-col items-center mb-6">
                <h1 className="text-3xl font-extrabold text-white mb-2 shadow-lg">Five Letters Multiplayer</h1>
                
                {/* Informação do Turno */}
                <h2 className={`text-xl mb-6 font-semibold border-b pb-2 ${isMyTurn ? 'text-yellow-400 border-yellow-700' : 'text-gray-400 border-gray-700'}`}>
                    {currentPlayerDisplay ? `Turno de: ${currentPlayerDisplay.name}` : 'Aguardando...'}
                </h2>

                {/* Tabuleiro do JOGADOR ATUAL */}
                <div className="space-y-2">
                    {myState?.guesses.map((guessEntry, rowIndex) => (
                        <div className="flex flex-row space-x-2" key={`my-guess-${rowIndex}`}>
                            {Array(wordLength).fill(0).map((_, cellIndex) => {
                                // O feedback está disponível!
                                const feedbackCell = guessEntry.feedback[cellIndex] || 0;
                                const letter = guessEntry.word[cellIndex] || '';
                                return (
                                    <div
                                        className={`
                                            w-12 h-12 sm:w-16 sm:h-16 border-2 rounded-md 
                                            transition duration-500 ease-in-out transform 
                                            flex justify-center items-center text-white font-extrabold text-2xl sm:text-3xl
                                            ${getCellClasses(feedbackCell)}
                                        `}
                                        key={cellIndex}
                                    >
                                        {letter}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Linha de Palpite Atual (Input) */}
                    {!gameState.gameOver && (
                        <div className="flex flex-row space-x-2">
                            {Array(wordLength).fill(0).map((_, cellIndex) => (
                                <div
                                    className={`
                                        w-12 h-12 sm:w-16 sm:h-16 border-gray-500 border-2 rounded-md 
                                        flex justify-center items-center text-white font-extrabold text-2xl sm:text-3xl
                                        ${isMyTurn && guessWord[cellIndex] ? 'bg-gray-700 border-white' : 'bg-[#0D1117]'}
                                    `}
                                    key={`current-input-${cellIndex}`}
                                >
                                    {guessWord[cellIndex] || ''}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ===================================
                INPUT E BOTÃO
            ==================================== */}
            <div className="flex flex-col items-center mt-8">
                <input
                    className="bg-gray-800 border border-gray-500 rounded-lg w-80 text-white font-bold text-center p-3 mb-4 focus:outline-none focus:border-green-400 text-xl"
                    value={guessWord}
                    onChange={(e: any) => setGuessWord(e.currentTarget.value.toUpperCase().slice(0, wordLength))}
                    maxLength={wordLength}
                    disabled={!isMyTurn || gameState.gameOver}
                    placeholder={isMyTurn ? "Digite seu palpite" : "Aguarde seu turno"}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && guessWord.length === wordLength) {
                            submitGuessToServer();
                        }
                    }}
                />
                <button
                    className={`
                        w-80 h-14 rounded-lg text-3xl text-white font-bold transition-all shadow-lg
                        ${guessWord.length === wordLength && isMyTurn && !gameState.gameOver
                            ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                            : 'bg-gray-500 cursor-not-allowed'}
                    `}
                    onClick={submitGuessToServer}
                    disabled={guessWord.length !== wordLength || !isMyTurn || gameState.gameOver}
                >
                    {gameState.gameOver ? 'FIM' : '✔️'}
                </button>
            </div>

            {/* Modal de Fim de Jogo */}
            <EndGameModal
                isOpen={gameState.gameOver}
                winnerName={winnerDisplay?.name || 'Desconhecido'}
                scoreboard={scoreboard}
                onRestart={restartGame}
            />
        </div>
    );
}
