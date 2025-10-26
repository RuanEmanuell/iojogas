interface PlayerScore {
  name: string;
  score: number;
}

interface EndGameModalProps {
  isOpen: boolean;
  winnerName: string;
  scoreboard: PlayerScore[]; // lista com todos os jogadores e suas pontuações
  onRestart?: () => void;
}

export function EndGameModal({
  isOpen,
  winnerName,
  scoreboard,
  onRestart,
}: EndGameModalProps) {
  // ordena o placar do maior para o menor
  const sortedScores = [...scoreboard].sort((a, b) => b.score - a.score);

  return (
    <div
      className={`fixed inset-0 flex justify-center items-center bg-black bg-opacity-70 z-50 transition-opacity duration-300
        ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div
        className={`rounded-2xl p-8 shadow-lg text-center w-96 transform transition-all duration-300
          ${isOpen ? "scale-100" : "scale-90"}
          bg-green-600 text-white`}
      >
        <h1 className="text-3xl font-bold mb-2">🏆 {winnerName} venceu!</h1>
        <p className="text-lg mb-6">Confira o placar final:</p>

        <div className="bg-white rounded-lg text-black p-4 mb-6 shadow-inner max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600">
                <th className="py-1">#</th>
                <th>Jogador</th>
                <th className="text-right">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              {sortedScores.map((player, index) => (
                <tr
                  key={player.name}
                  className={`${
                    index === 0 ? "font-bold text-green-700" : ""
                  } border-b border-gray-200`}
                >
                  <td className="py-1">{index + 1}</td>
                  <td>{player.name}</td>
                  <td className="text-right">{player.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          className="px-6 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition cursor-pointer"
          onClick={onRestart}
        >
          🔄 Jogar novamente
        </button>
      </div>
    </div>
  );
}
