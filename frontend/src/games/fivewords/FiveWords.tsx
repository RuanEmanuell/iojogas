import { signal } from "@preact/signals";
import { EndGameModal } from "./components/EndGameModal";

const guessArray = signal(Array(5).fill(null).map(() => Array(5).fill(0)));
const guessWords = signal(Array(5).fill(null).map(() => Array(5).fill("")));
const guessWord = signal("");
const currentTry = signal(0);

// 0: jogando, 1: ganhou, 2: perdeu
const gameState = signal(0); 

function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

let correctWord = wordArray[getRandomNumber(0, wordArray.length - 1)];

export function FiveWords() {
  console.log(correctWord);
  async function testGuess() {
    if (guessWord.value.length !== 5 || gameState.value !== 0) return;

    const correctWordArray = correctWord.toUpperCase().split("");
    const guessWordArray = guessWord.value.toUpperCase().split("");
    const newGuessArray = [...guessArray.value];
    const newGuessWords = [...guessWords.value];

    newGuessWords[currentTry.value] = guessWordArray;
    guessWords.value = [...newGuessWords];

    for (let i = 0; i < 5; i++) {
      await sleep(200);
      newGuessArray[currentTry.value][i] =
        correctWordArray[i] === guessWordArray[i] ? 1 : 2;
      guessArray.value = [...newGuessArray];
    }

    const isCorrect = guessWord.value.toUpperCase() === correctWord.toUpperCase();

    if (isCorrect) {
      gameState.value = 1;
    } else if (currentTry.value === 4) {
      gameState.value = 2;
    }

    currentTry.value += 1;
    guessWord.value = "";
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function restartGame() {
    gameState.value = 0;
    currentTry.value = 0;
    guessWord.value = "";
    guessArray.value = Array(5).fill(null).map(() => Array(5).fill(0));
    guessWords.value = Array(5).fill(null).map(() => Array(5).fill(""));
    correctWord = wordArray[getRandomNumber(0, wordArray.length - 1)];
  }

  return (
    <div class="bg-[#0D1117] min-h-screen min-w-screen flex flex-col justify-center items-center">
      <div class="flex flex-col items-center mb-8">
        {guessArray.value.map((guessRow, rowIndex) => (
          <div class="flex flex-row" key={rowIndex}>
            {guessRow.map((cell, cellIndex) => (
              <div
                class={`m-1 w-16 h-16 border-gray-700 border-2 rounded-sm transition duration-300 flex justify-center items-center text-white font-bold text-2xl
                  ${cell === 0
                    ? 'bg-[#0D1117]'
                    : cell === 1
                      ? 'bg-green-500 border-white'
                      : 'bg-red-500 border-white'
                  }`}
              >
                {guessWords.value[rowIndex][cellIndex] || ''}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div class="flex flex-col items-center">
        <input
          class="bg-transparent border border-gray-500 rounded-sm w-72 text-white font-bold text-center p-2 mb-4 focus:outline-none focus:border-green-400"
          value={guessWord.value}
          onChange={(e: any) => { guessWord.value = e.currentTarget.value }}
          maxLength={5}
        />
        <button
          class="bg-green-600 hover:bg-green-700 w-72 h-12 rounded-sm text-2xl text-white font-bold transition-all cursor-pointer"
          onClick={testGuess}
        >
          ✔️
        </button>
      </div>

      <EndGameModal
        isOpen={gameState.value !== 0}
        type={gameState.value === 1 ? "win" : "lose"}
        tryCount={currentTry.value + 1}
        correctWord={correctWord}
        onRestart={restartGame}
      />
    </div>
  );
}
