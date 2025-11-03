import type { MatchHistoryGame, Champion } from "../../types";
import MatchHistoryItem from "./MatchHistoryItem";

interface MatchHistoryProps {
  matchHistory: MatchHistoryGame[];
  champions: Map<number, Champion>;
  championVersion: string;
}

export default function MatchHistory({ matchHistory, champions, championVersion }: MatchHistoryProps) {
  if (matchHistory.length === 0) return null;

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/30 shadow-lg">
      <h3 className="text-xl font-bold text-white mb-4">Recent Games</h3>
      <div className="space-y-3">
        {matchHistory.map((game) => {
          const champion = champions.get(game.champion_id);
          return (
            <MatchHistoryItem
              key={game.game_id}
              game={game}
              champion={champion}
              championVersion={championVersion}
            />
          );
        })}
      </div>
    </div>
  );
}

