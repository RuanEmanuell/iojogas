import { Player } from "../types/player";
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
    // secretWord é apenas para o servidor - não deve ser enviado ao cliente
    players: Record<string, { name: string, guesses: { word: string, feedback: number[] }[], score: number }>;
    currentPlayerId: string | null;
    gameOver: boolean;
    winnerId: string | null;
}

// Mapeamento de Feedback para o Frontend:
// 1: Verde (Posição Correta)
// 3: Amarelo (Letra Existe, Posição Errada)
// 2: Vermelho/Cinza (Letra Não Existe)
type Feedback = 1 | 2 | 3;

export class FiveLettersController {
    roomName: string
    players: Player[];
    io: any;
    gameState: GameState
    secretWord: string;

    constructor(roomName: string, players: Player[], io: any) {
        this.roomName = roomName;
        this.players = players;
        this.io = io;
        this.secretWord = secretWordArray[getRandomNumber(0, secretWordArray.length - 1)]
        this.gameState = {
            wordLength: this.secretWord.length,
            // Não incluímos secretWord no gameState público
            players: players.reduce((acc, p) => ({
                ...acc,
                [p.id]: { name: p.userName, guesses: [], score: 0 }
            }), {}),
            currentPlayerId: players[0].id,
            winnerId: null,
            gameOver: false
        };
    }

    /**
     * Gera o feedback (1: verde, 3: amarelo, 2: vermelho/cinza)
     */
    private getFeedback(guess: string): Feedback[] {
        const feedback: Feedback[] = Array(guess.length).fill(2); // Inicia como "vermelho/cinza" (2)
        const secretLetters = this.secretWord.split('');
        const guessLetters = guess.split('');

        // Passo 1: Marcar Verdes (1 - Posição Correta)
        for (let i = 0; i < guessLetters.length; i++) {
            if (guessLetters[i] === secretLetters[i]) {
                feedback[i] = 1;
                // Marcar a letra secreta como usada para evitar contagem dupla
                secretLetters[i] = '\0'; // Caractere nulo para indicar que foi usado
            }
        }

        // Passo 2: Marcar Amarelos (3 - Letra Existe, Posição Errada)
        for (let i = 0; i < guessLetters.length; i++) {
            if (feedback[i] !== 1) { // Só verifica se não for verde
                const char = guessLetters[i];
                const indexInSecret = secretLetters.findIndex(s => s === char);

                if (indexInSecret !== -1) {
                    feedback[i] = 3;
                    // Marcar a letra secreta como usada
                    secretLetters[indexInSecret] = '\0';
                }
            }
        }

        return feedback;
    }

    startGame() {
        // Envia o estado inicial do jogo para todos na sala
        this.io.in(this.roomName).emit("fiveLettersUpdate", {
            currentGameState: this.getGameState()
        });
    }

    handleGuess(playerId: string, guessedWord: string) {
        if (this.gameState.gameOver) return;

        const normalizedGuess = guessedWord.toUpperCase();
        const playerState = this.gameState.players[playerId];

        if (!playerState || this.gameState.currentPlayerId !== playerId) {
            // Se não for a vez do jogador, emite um erro privado
            this.io.to(playerId).emit('guessError', { message: 'Não é sua vez ou você não está no jogo.' });
            return;
        }

        if (normalizedGuess.length !== this.gameState.wordLength) {
            this.io.to(playerId).emit('guessError', { message: `A palavra deve ter ${this.gameState.wordLength} letras.` });
            return;
        }

        // 🚨 NOVO: Calcula o feedback
        const feedback = this.getFeedback(normalizedGuess);
        const isCorrect = normalizedGuess === this.secretWord;

        // Atualiza o palpite do jogador
        playerState.guesses.push({
            word: normalizedGuess,
            feedback: feedback // 🚨 Agora tem o feedback!
        });

        if (isCorrect) {
            playerState.score += 100; // Pontuação por vencer
            this.gameState.winnerId = playerId;
            this.gameState.gameOver = true;
        } else {
            // Passa o turno
            const playerIds = this.players.map(p => p.id);
            const currentIndex = playerIds.indexOf(playerId);
            const nextIndex = (currentIndex + 1) % playerIds.length;
            this.gameState.currentPlayerId = playerIds[nextIndex];
        }

        // 📢 Emite o estado ATUALIZADO para todos
        this.io.to(this.roomName).emit("fiveLettersUpdate", {
            currentGameState: this.gameState,
        });

        if (this.gameState.gameOver) {
            this.io.to(this.roomName).emit("gameOver", { winnerId: this.gameState.winnerId, secretWord: this.secretWord });
        }
    }

    getGameState(): GameState {
        // Pode fazer um spread para garantir que o frontend não consiga alterar o estado do servidor
        return {
            wordLength: this.gameState.wordLength,
            players: { ...this.gameState.players },
            currentPlayerId: this.gameState.currentPlayerId,
            gameOver: this.gameState.gameOver,
            winnerId: this.gameState.winnerId
        };
    }
}
