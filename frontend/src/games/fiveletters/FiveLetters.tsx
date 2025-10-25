import { useState, useEffect } from "react";

import { EndGameModal } from "./components/EndGameModal";

const getRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const wordArray = [
  "ANDAR", "AGORA", "AVISO", "ANTES", "AREIA",
  "BEBER", "BUSCA", "BANCO", "BEIJO",
  "CERTO", "CORPO", "CARNE", "CASAR", "CAUSA",
  "DIZER", "DOCES", "DUZIA", "DADOS", "DOADO",
  "EXATO", "ESTAR", "EXIGE", "ESQUI",
  "FACIL", "FELIZ", "FALAR", "FOLHA", "FALSO",
  "GRITO", "GRAMA", "GASTO", "GIRAR", "GESSO",
  "JOGAR", "JOVEM", "JUNTO", "JESUS", "JANTA",
  "LIGAR", "LAZER", "LINDO", "LUTAR", "LIMPO",
  "MASSA", "METER", "MORAL", "MUSEU", "MOVEL",
  "NADAR", "NOITE", "NOVOS", "NOBRE", "NOTAS",
  "OLHAR", "OESTE", "ORDEM", "OUSAR", "ONTEM"
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
  const [gameState, setGameState] = useState(0); // 0: jogando, 1: ganhou, 2: perdeu
  const [correctWord, setCorrectWord] = useState(
    () => wordArray[getRandomNumber(0, wordArray.length - 1)]
  );

  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (gameState !== 0) return;
    if (timeLeft === 0) {
      setGameState(2);
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameState]);

  async function testGuess() {
    if (guessWord.length !== 5 || gameState !== 0) return;


    const currentGuessLetters = guessWord.split(""); 
    const mutableCorrectWord = correctWord.split(""); 
    const mutableGuessWord = guessWord.split("");   
    
    const newGuessArray = guessArray.map(row => [...row]);
    const newGuessWords = guessWords.map(row => [...row]);

    newGuessWords[currentTry] = currentGuessLetters;
    setGuessWords(newGuessWords); 

    for (let i = 0; i < 5; i++) {
      await sleep(100);

      if (mutableGuessWord[i] === mutableCorrectWord[i]) {
        newGuessArray[currentTry][i] = 1;
        mutableCorrectWord[i] = null!; 
        mutableGuessWord[i] = null!;
      }
    }


    for (let i = 0; i < 5; i++) {
      if (!mutableGuessWord[i]) continue; 

      const indexInCorrect = mutableCorrectWord.indexOf(mutableGuessWord[i]);
      if (indexInCorrect !== -1) {
        newGuessArray[currentTry][i] = 3;
        mutableCorrectWord[indexInCorrect] = null!; 
      } else {
        newGuessArray[currentTry][i] = 2; 
      }

      setGuessArray(newGuessArray.map(row => [...row]));
      await sleep(100);
    }

    const isCorrect = guessWord.toUpperCase() === correctWord.toUpperCase();

    if (isCorrect) {
      const basePoints = 100;
      const penalty = currentTry * 20;
      const bonus = timeLeft * 2;
      const finalScore = Math.max(basePoints - penalty + bonus, 0);
      setScore(finalScore);
      setGameState(1);
    } else if (currentTry === 4) {
      setGameState(2);
    }

    setCurrentTry(prev => prev + 1);
    setGuessWord("");
  }


  function restartGame() {
    setGameState(0);
    setCurrentTry(0);
    setGuessWord("");
    setGuessArray(Array(5).fill(null).map(() => Array(5).fill(0)));
    setGuessWords(Array(5).fill(null).map(() => Array(5).fill("")));
    setCorrectWord(wordArray[getRandomNumber(0, wordArray.length - 1)]);
    setTimeLeft(60);
  }

  const getCellClasses = (cell: number) => {
    switch (cell) {
      case 1: return 'bg-green-500 border-white rotate-y-360'; 
      case 2: return 'bg-red-500 border-white';                  
      case 3: return 'bg-yellow-400 border-white';               
      default: return 'bg-[#0D1117]';                       
    }
  }

  return (
    <div className="bg-[#0D1117] min-h-screen min-w-screen flex flex-col justify-center items-center p-4">
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-extrabold text-white mb-4 shadow-lg">5 Letras</h1>
        <h2 className="text-white text-xl mb-6 font-semibold border-b border-gray-700 pb-2">Tempo restante: {timeLeft}s</h2>

        {/* Word Grid */}
        <div className="space-y-2">
          {guessArray.map((guessRow, rowIndex) => (
            <div className="flex flex-row space-x-2" key={rowIndex}>
              {guessRow.map((cell, cellIndex) => (
                <div
                  className={`
                    w-16 h-16 border-gray-700 border-2 rounded-md 
                    transition duration-500 ease-in-out transform 
                    flex justify-center items-center text-white font-extrabold text-3xl
                    ${getCellClasses(cell)}
                    ${rowIndex === currentTry && guessWords[rowIndex][cellIndex] ? 'animate-pulse' : ''}
                  `}
                  key={cellIndex}
                  style={{
                    animationDelay: `${cellIndex * 0.1}s`,
                    perspective: '1000px',
                    transform: cell !== 0 ? 'rotateX(0deg)' : 'rotateX(0deg)',
                  }}
                >
                  {guessWords[rowIndex][cellIndex] || (
                    rowIndex === currentTry ? guessWord[cellIndex] || '' : ''
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Input and Submit */}
      <div className="flex flex-col items-center mt-8">
        <input
          className="bg-gray-800 border border-gray-500 rounded-lg w-80 text-white font-bold text-center p-3 mb-4 focus:outline-none focus:border-green-400 text-xl"
          value={guessWord}
          onChange={(e: any) => setGuessWord(e.currentTarget.value.toUpperCase())}
          maxLength={5}
          disabled={gameState !== 0}
          placeholder="Digite 5 letras"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && guessWord.length === 5) {
              testGuess();
            }
          }}
        />
        <button
          className={`
            w-80 h-14 rounded-lg text-3xl text-white font-bold transition-all shadow-lg
            ${guessWord.length === 5 && gameState === 0 
              ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
              : 'bg-gray-500 cursor-not-allowed'}
          `}
          onClick={testGuess}
          disabled={guessWord.length !== 5 || gameState !== 0}
        >
          ✔️
        </button>
      </div>

      <EndGameModal
        isOpen={gameState !== 0}
        type={gameState === 1 ? "win" : "lose"}
        tryCount={currentTry}
        correctWord={correctWord}
        timeLeft={timeLeft}
        score={score}
        onRestart={restartGame}
      />
    </div>
  );
}
