import { Player } from "../types/Player";
import { getRandomNumber } from "../utils/getRandomNumber";

const secretWordArray = [
    'ABAIXO', 'ABRIGO', 'ABUSOS', 'ADULTO', 'AFINAL', 'ALERTA',
    'APOSTA', 'BAIXAR', 'BALADA', 'BANCOS', 'BARATO', 'BOMBAS',
    'BUSCAR', 'BRANCO', 'CADELA', 'CALADA', 'CALADO', 'CAMARA',
    'CASUAL', 'CAUSAS', 'CHAMAR', 'CIDADE', 'DEIXAR', 'DEMAIS',
    'DEPOIS', 'DIANTE', 'DIVIDA', 'DOENCA', 'DUVIDA', 'DIARIA',
    'DIGITA', 'EFEITO', 'ELEVAR', 'ENORME', 'ENSINO', 'ESCOLA',
    'ESPACO', 'ESTADO', 'ESTILO', 'EXATAS', 'FACADA', 'FESTAS',
    'FILTRO', 'FLORAL', 'FORMAR', 'FRENTE', 'GANHAR', 'GAROTO',
    'GASTOS', 'GELADO', 'GLORIA', 'GOSTOS', 'GRANDE', 'GRITOS',
    'HABITO', 'HUMANO', 'IDEIAS', 'IMAGEM', 'IDOSOS', 'IDOLOS',
    'INICIO', 'ISOLAR', 'IMORAL', 'JANELA', 'JARDIM', 'JORNAL',
    'JULGAR', 'JURADA', 'LAGOAS', 'LARGAS', 'LEMBRA', 'LIGADO',
    'LIMITE', 'LIVROS', 'LOUCOS', 'MACACA', 'MALHAS', 'MANCHA',
    'MANGAS', 'MARCAR', 'MEDIDA', 'MELHOR', 'NOITES', 'NORMAL',
    'NUVENS', 'OCULTO', 'OFERTA', 'PASSAR', 'PENSAO', 'PEDIDO',
    'PESADO', 'PESSOA', 'PLACAR', 'PLANTA', 'PROVAR', 'QUANDO',
    'QUANTO', 'QUENTE', 'QUERER', 'QUEIXA', 'RECEBA', 'REMOTO',
    'RISCOS', 'ROUBAR', 'SALADA', 'SALVAR', 'SENTAR', 'SERIAS',
    'SORRIR', 'TALVEZ', 'TENTAR', 'TROCAR', 'TECLAR', 'ULTIMO',
    'UNIDOS', 'UNIVER', 'VELHOS', 'VIAGEM', 'XERIFE', 'ZANGAO',
    'ZERADO', 'ZUMBIR', 'ZUMBIS'
];

interface GameState {
    wordLength: number;
    players: Record<string, { name: string, guesses: { word: string, feedback: number[] }[], score: number }>;
    currentPlayerId: string | null;
    gameOver: boolean;
    winnerId: string | null;
}

type Feedback = 1 | 2 | 3;

export class FiveLettersController {
    roomName: string;
    players: Player[];
    io: any;
    gameState: GameState;
    secretWord: string;

    constructor(roomName: string, players: Player[], io: any) {
        this.roomName = roomName;
        this.players = players;
        this.io = io;
        this.secretWord = secretWordArray[getRandomNumber(0, secretWordArray.length - 1)];
        this.gameState = {
            wordLength: this.secretWord.length,
            players: players.reduce((acc, p) => ({
                ...acc,
                [p.id]: { name: p.userName, guesses: [], score: 0 }
            }), {}),
            currentPlayerId: players[0].id,
            winnerId: null,
            gameOver: false
        };
    }

    private getFeedback(guess: string): Feedback[] {
        const feedback: Feedback[] = Array(guess.length).fill(2);
        const secretLetters = this.secretWord.split('');
        const guessLetters = guess.split('');

        for (let i = 0; i < guessLetters.length; i++) {
            if (guessLetters[i] === secretLetters[i]) {
                feedback[i] = 1;
                secretLetters[i] = '\0';
            }
        }

        for (let i = 0; i < guessLetters.length; i++) {
            if (feedback[i] !== 1) {
                const char = guessLetters[i];
                const indexInSecret = secretLetters.findIndex(s => s === char);
                if (indexInSecret !== -1) {
                    feedback[i] = 3;
                    secretLetters[indexInSecret] = '\0';
                }
            }
        }

        return feedback;
    }

    startGame() {
        this.io.in(this.roomName).emit("fiveLettersUpdate", {
            currentGameState: this.getGameState()
        });
    }

    handleGuess(playerId: string, guessedWord: string) {
        if (this.gameState.gameOver) return;

        const normalizedGuess = guessedWord.toUpperCase();
        const playerState = this.gameState.players[playerId];

        if (!playerState || this.gameState.currentPlayerId !== playerId) {
            this.io.to(playerId).emit('guessError', { message: 'Não é sua vez ou você não está no jogo.' });
            return;
        }

        if (normalizedGuess.length !== this.gameState.wordLength) {
            this.io.to(playerId).emit('guessError', { message: `A palavra deve ter ${this.gameState.wordLength} letras.` });
            return;
        }

        const feedback = this.getFeedback(normalizedGuess);
        const isCorrect = normalizedGuess === this.secretWord;

        playerState.guesses.push({ word: normalizedGuess, feedback });

        if (isCorrect) {
            playerState.score += 100;
            this.gameState.winnerId = playerId;
            this.gameState.gameOver = true;
        } else {
            const playerIds = this.players.map(p => p.id);
            const currentIndex = playerIds.indexOf(playerId);
            const nextIndex = (currentIndex + 1) % playerIds.length;
            this.gameState.currentPlayerId = playerIds[nextIndex];
        }

        this.io.to(this.roomName).emit("fiveLettersUpdate", {
            currentGameState: this.gameState
        });

        if (this.gameState.gameOver) {
            this.io.to(this.roomName).emit("gameOver", {
                winnerId: this.gameState.winnerId,
                secretWord: this.secretWord
            });
        }
    }

    getGameState(): GameState {
        return {
            wordLength: this.gameState.wordLength,
            players: { ...this.gameState.players },
            currentPlayerId: this.gameState.currentPlayerId,
            gameOver: this.gameState.gameOver,
            winnerId: this.gameState.winnerId
        };
    }
}
