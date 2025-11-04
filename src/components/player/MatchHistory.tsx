import type { MatchHistoryGame, Champion } from "../../types";
import MatchHistoryItem from "./MatchHistoryItem";

interface MatchHistoryProps {
  matchHistory: MatchHistoryGame[];
  champions: Map<number, Champion>;
  championVersion: string;
  isLoadingMore?: boolean;
  hasMoreGames?: boolean;
  getChampionCenteredImageUrl: (championId: number) => string;
  getChampionName: (championId: number) => string;
}

export default function MatchHistory({ 
  matchHistory, 
  champions, 
  championVersion,
  isLoadingMore = false,
  hasMoreGames = false,
  getChampionCenteredImageUrl,
  getChampionName
}: MatchHistoryProps) {
  if (matchHistory.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-xl rounded-xl p-8 border border-gray-700/30 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-2">Recent Games</h3>
        <p className="text-gray-400 text-sm">No games found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white">Recent Games</h2>
      </div>
      <div className="space-y-3">
        {matchHistory.map((game) => {
          const champion = champions.get(game.champion_id);
          return (
            <MatchHistoryItem
              key={game.game_id}
              game={game}
              champion={champion}
              championVersion={championVersion}
              getChampionCenteredImageUrl={getChampionCenteredImageUrl}
              getChampionName={getChampionName}
            />
          );
        })}
        
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
          </div>
        )}
        
        {!hasMoreGames && matchHistory.length > 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No more games to load
          </div>
        )}
      </div>
    </div>
  );
}
