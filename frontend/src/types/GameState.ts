export interface GameState {
    wordLength: number;
    players: Record<string, {
        name: string;
        guesses: {
            word: string;
            feedback: number[]; // 1: Verde, 3: Amarelo, 2: Vermelho
        }[];
        score: number;
    }>;
    currentPlayerId: string | null;
    gameOver: boolean;
    winnerId: string | null;
}

export interface PlayerDisplay {
    id: string;
    name: string;
    guesses: { word: string, feedback: number[] }[];
    score: number;
    isCurrentPlayer: boolean;
}
