interface EndGameModalProps {
  isOpen: boolean;
  type: "win" | "lose";
  correctWord?: string;
  tryCount: number;
  score?: number;       
  timeLeft?: number;    
  onRestart?: () => void;
}

export function EndGameModal({
  isOpen,
  type,
  correctWord,
  tryCount,
  score,
  timeLeft,
  onRestart
}: EndGameModalProps) {
  return (
    <div
      className={`fixed inset-0 flex justify-center items-center bg-black bg-opacity-70 z-50 transition-opacity duration-300
        ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div
        className={`rounded-2xl p-8 shadow-lg text-center w-80 transform transition-all duration-300
          ${isOpen ? "scale-100" : "scale-90"}
          ${type === "win" ? "bg-green-600" : "bg-red-600"} text-white`}
      >
        <h1 className="text-3xl font-bold mb-4">
          {type === "win" ? "🎉 Você venceu!" : "❌ Fim de jogo!"}
        </h1>

        <h2 className="text-2xl font-bold mb-2">
          {`Tentativas: ${tryCount}`}
        </h2>

        {score !== undefined && (
          <h2 className="text-2xl font-bold mb-2">
            {`Pontos: ${score}`}
          </h2>
        )}

        {timeLeft !== undefined && (
          <h2 className="text-2xl font-bold mb-4">
            {`Tempo restante: ${timeLeft}s`}
          </h2>
        )}

        {type === "lose" && (
          <p className="text-lg mb-4">
            A palavra era <span className="font-bold">{correctWord?.toUpperCase()}</span>
          </p>
        )}

        <button
          className="mt-2 px-4 py-2 rounded-md bg-white text-black font-semibold hover:bg-gray-200 transition cursor-pointer"
          onClick={onRestart}
        >
          Jogar novamente
        </button>
      </div>
    </div>
  );
}
