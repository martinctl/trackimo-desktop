import type { MatchHistoryGame, Champion } from "../../types";

interface MatchHistoryItemProps {
  game: MatchHistoryGame;
  champion: Champion | undefined;
  championVersion: string;
}

export default function MatchHistoryItem({ game, champion, championVersion }: MatchHistoryItemProps) {
  const kda = game.deaths > 0 
    ? ((game.kills + game.assists) / game.deaths).toFixed(2)
    : (game.kills + game.assists).toFixed(1);
  const minutes = Math.floor(game.game_duration / 60);
  const seconds = game.game_duration % 60;

  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        game.win 
          ? 'bg-blue-500/10 border-blue-400/30 hover:bg-blue-500/15' 
          : 'bg-red-500/10 border-red-400/30 hover:bg-red-500/15'
      }`}
    >
      {/* Champion Icon */}
      <div className="flex-shrink-0">
        <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
          game.win ? 'border-blue-400/50' : 'border-red-400/50'
        }`}>
          {champion && (
            <img 
              src={`https://ddragon.leagueoflegends.com/cdn/${championVersion}/img/champion/${champion.id}.png`}
              alt={champion.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-sm font-bold ${game.win ? 'text-blue-400' : 'text-red-400'}`}>
            {game.win ? 'Victory' : 'Defeat'}
          </span>
          <span className="text-gray-500 text-sm">•</span>
          <span className="text-gray-400 text-sm">{minutes}:{seconds.toString().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white font-semibold">
            {game.kills} / {game.deaths} / {game.assists}
          </span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">
            <span className="text-cyan-400 font-bold">{kda}</span> KDA
          </span>
        </div>
      </div>

      {/* Champion Name */}
      <div className="hidden md:block text-right">
        <div className="text-white font-semibold">{champion?.name || 'Unknown'}</div>
        <div className="text-gray-400 text-xs">{champion?.title || ''}</div>
      </div>
    </div>
  );
}

