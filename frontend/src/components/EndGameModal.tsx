interface EndGameModalProps {
  isOpen: boolean;
  type: "win" | "lose";
  correctWord?: string;
  tryCount: number;
  onRestart?: () => void;
}

export function EndGameModal({ isOpen, type, correctWord, tryCount, onRestart }: EndGameModalProps) {
  return (
    <div
      class={`fixed inset-0 flex justify-center items-center bg-black bg-opacity-70 z-50 transition-opacity duration-300
        ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div
        class={`rounded-2xl p-8 shadow-lg text-center w-80 transform transition-all duration-300
          ${isOpen ? "scale-100" : "scale-90"}
          ${type === "win" ? "bg-green-600" : "bg-red-600"} text-white`}
      >
        <h1 class="text-3xl font-bold mb-4">
          {type === "win" ? "🎉 Você venceu!" : "❌ Fim de jogo!"}
        </h1>

        <h2 class="text-2xl font-bold mb-4">
          {`Tentativas: ${tryCount}`}
        </h2>

        {type === "lose" && (
          <p class="text-lg mb-4">
            A palavra era <span class="font-bold">{correctWord?.toUpperCase()}</span>
          </p>
        )}

        <button
          class="mt-2 px-4 py-2 rounded-md bg-white text-black font-semibold hover:bg-gray-200 transition cursor-pointer"
          onClick={onRestart}
        >
          Jogar novamente
        </button>
      </div>
    </div>
  );
}
