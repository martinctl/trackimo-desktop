import type { MatchHistoryGame, Champion } from "../../types";

interface MatchHistoryItemProps {
  game: MatchHistoryGame;
  champion: Champion | undefined;
  championVersion: string;
  getChampionCenteredImageUrl: (championId: number) => string;
  getChampionName: (championId: number) => string;
}

export default function MatchHistoryItem({ 
  game, 
  champion, 
  getChampionCenteredImageUrl,
  getChampionName
}: MatchHistoryItemProps) {
  const kda = game.deaths > 0 
    ? ((game.kills + game.assists) / game.deaths).toFixed(2)
    : (game.kills + game.assists).toFixed(1);
  const minutes = Math.floor(game.game_duration / 60);
  const seconds = game.game_duration % 60;

  return (
    <div 
      className={`relative flex items-center bg-gradient-to-r ${
        game.win 
          ? "from-blue-950/30 to-blue-900/20" 
          : "from-red-950/30 to-red-900/20"
      } backdrop-blur-sm border-b ${
        game.win 
          ? "border-blue-500/20" 
          : "border-red-500/20"
      } overflow-hidden h-[120px]`}
    >
      {/* Champion Centered Image */}
      <div 
        className={`relative flex-1 h-full ${
          game.win 
            ? "border-l-4 border-blue-400/50 shadow-lg shadow-blue-400/20" 
            : "border-l-4 border-red-400/50 shadow-lg shadow-red-400/20"
        }`}
      >
        <div className="relative w-full h-full overflow-hidden">
          {champion && game.champion_id ? (
            <>
              <img
                src={getChampionCenteredImageUrl(game.champion_id)}
                alt={getChampionName(game.champion_id)}
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center 25%' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-r ${
                game.win
                  ? "from-blue-950/80 via-blue-950/40 to-transparent"
                  : "from-red-950/80 via-red-950/40 to-transparent"
              } pointer-events-none`} />
              
              {/* Game Info Overlay */}
              <div className={`absolute left-3 bottom-2 z-10 ${
                game.win 
                  ? "text-blue-100" 
                  : "text-red-100"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${game.win ? 'text-blue-300' : 'text-red-300'}`}>
                    {game.win ? 'Victory' : 'Defeat'}
                  </span>
                  <span className="text-gray-400 text-xs">•</span>
                  <span className="text-gray-300 text-xs">{minutes}:{seconds.toString().padStart(2, '0')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {game.kills} / {game.deaths} / {game.assists}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-cyan-300 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {kda} KDA
                  </span>
                </div>
              </div>

              {/* Champion Name Overlay */}
              <div className={`absolute right-3 bottom-2 z-10 ${
                game.win 
                  ? "text-blue-100" 
                  : "text-red-100"
              }`}>
                <div className="text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {getChampionName(game.champion_id)}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
              <span className="text-gray-500 text-3xl font-bold">?</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

