import { useState } from "react"
import { EndGameModal } from "./components/EndGameModal";
import { getRandomNumber } from "../../utils/getRandomNumber";

const wordArray = [
  "andar", "agora", "aviso", "antes", "areia",
  "beber", "busca", "bairro", "banco", "beijo",
  "certo", "corpo", "carne", "casar", "causa",
  "dizer", "doces", "duzia", "dados", "doado",
  "exato", "estar", "exige", "esqui", "elias",
  "facil", "feliz", "falar", "folha", "falso",
  "grito", "grama", "gasto", "girar", "gesso",
  "jogar", "jovem", "junto", "jesus", "janta",
  "ligar", "lazer", "lindo", "lutar", "limpo",
  "massa", "meter", "moral", "museu", "movel",
  "nadar", "noite", "novos", "nobre", "notas",
  "olhar", "oeste", "ordem", "ousar", "ontem"
];

export function FiveLetters() {
  const [guessArray, setGuessArray] = useState<number[][]>(() =>
    Array(5).fill(null).map(() => Array(5).fill(0))
  );
  const [guessWords, setGuessWords] = useState<string[][]>(() =>
    Array(5).fill(null).map(() => Array(5).fill(""))
  );
  const [guessWord, setGuessWord] = useState("");
  const [currentTry, setCurrentTry] = useState(0);
  // 0: jogando, 1: ganhou, 2: perdeu
  const [gameState, setGameState] = useState(0);
  const [correctWord, setCorrectWord] = useState(
    () => wordArray[getRandomNumber(0, wordArray.length - 1)]
  );

  console.log(correctWord);

  async function testGuess() {
    if (guessWord.length !== 5 || gameState !== 0) return;

    const correctWordArray = correctWord.toUpperCase().split("");
    const guessWordArray = guessWord.toUpperCase().split("");
    const newGuessArray = guessArray.map(row => [...row]);
    const newGuessWords = guessWords.map(row => [...row]);

    newGuessWords[currentTry] = guessWordArray;
    setGuessWords(newGuessWords);

    for (let i = 0; i < 5; i++) {
      await sleep(200);
      newGuessArray[currentTry][i] =
        correctWordArray[i] === guessWordArray[i] ? 1 : 2;
      setGuessArray(newGuessArray.map(row => [...row]));
    }

    const isCorrect = guessWord.toUpperCase() === correctWord.toUpperCase();

    if (isCorrect) {
      setGameState(1);
    } else if (currentTry === 4) {
      setGameState(2);
    }

    setCurrentTry(prev => prev + 1);
    setGuessWord("");
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function restartGame() {
    setGameState(0);
    setCurrentTry(0);
    setGuessWord("");
    setGuessArray(Array(5).fill(null).map(() => Array(5).fill(0)));
    setGuessWords(Array(5).fill(null).map(() => Array(5).fill("")));
    setCorrectWord(wordArray[getRandomNumber(0, wordArray.length - 1)]);
  }

  return (
    <div className="bg-[#0D1117] min-h-screen min-w-screen flex flex-col justify-center items-center">
      <div className="flex flex-col items-center mb-8">
        {guessArray.map((guessRow, rowIndex) => (
          <div className="flex flex-row" key={rowIndex}>
            {guessRow.map((cell, cellIndex) => (
              <div
                className={`m-1 w-16 h-16 border-gray-700 border-2 rounded-sm transition duration-300 flex justify-center items-center text-white font-bold text-2xl
                  ${cell === 0
                    ? 'bg-[#0D1117]'
                    : cell === 1
                      ? 'bg-green-500 border-white'
                      : 'bg-red-500 border-white'
                  }`}
                key={cellIndex}
              >
                {guessWords[rowIndex][cellIndex] || ''}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center">
        <input
          className="bg-transparent border border-gray-500 rounded-sm w-72 text-white font-bold text-center p-2 mb-4 focus:outline-none focus:border-green-400"
          value={guessWord}
          onChange={(e: any) => setGuessWord(e.currentTarget.value)}
          maxLength={5}
        />
        <button
          className="bg-green-600 hover:bg-green-700 w-72 h-12 rounded-sm text-2xl text-white font-bold transition-all cursor-pointer"
          onClick={testGuess}
        >
          ✔️
        </button>
      </div>

      <EndGameModal
        isOpen={gameState !== 0}
        type={gameState === 1 ? "win" : "lose"}
        tryCount={currentTry + 1}
        correctWord={correctWord}
        onRestart={restartGame}
      />
    </div>
  );
}
