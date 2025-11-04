import type { MatchHistoryGame, Champion, RankedStats } from "../../types";

interface StatsPanelProps {
  matchHistory: MatchHistoryGame[];
  champions: Map<number, Champion>;
  championVersion: string;
  rankedStats: RankedStats[];
}

export default function StatsPanel({
  matchHistory,
  champions,
  championVersion,
  rankedStats
}: StatsPanelProps) {
  // Calculate general stats
  const totalGames = matchHistory.length;
  const wins = matchHistory.filter(g => g.win).length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  
  const totalKills = matchHistory.reduce((sum, g) => sum + g.kills, 0);
  const totalDeaths = matchHistory.reduce((sum, g) => sum + g.deaths, 0);
  const totalAssists = matchHistory.reduce((sum, g) => sum + g.assists, 0);
  const avgKDA = totalGames > 0 
    ? ((totalKills + totalAssists) / Math.max(totalDeaths, 1)).toFixed(2)
    : "0.00";

  const getRankImage = (tier: string) => {
    const tierLower = tier.toLowerCase();
    return `/ranks/${tierLower}.png`;
  };
  const championStats = new Map<number, { games: number; wins: number; kills: number; deaths: number; assists: number }>();
  
  matchHistory.forEach(game => {
    const current = championStats.get(game.champion_id) || { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
    championStats.set(game.champion_id, {
      games: current.games + 1,
      wins: current.wins + (game.win ? 1 : 0),
      kills: current.kills + game.kills,
      deaths: current.deaths + game.deaths,
      assists: current.assists + game.assists
    });
  });

  const topChampions = Array.from(championStats.entries())
    .map(([championId, stats]) => ({
      championId,
      champion: champions.get(championId),
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
      kda: ((stats.kills + stats.assists) / Math.max(stats.deaths, 1)).toFixed(2)
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* General Stats Card */}
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/60 backdrop-blur-xl border border-gray-700/30 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800/50 to-transparent border-b border-gray-700/30 px-4 py-2.5">
          <h3 className="text-base font-bold text-white">General Stats</h3>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between py-1.5 border-b border-gray-700/20">
            <span className="text-gray-400 text-xs">Win Rate</span>
            <span className={`text-base font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {winRate}%
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-700/20">
            <span className="text-gray-400 text-xs">Wins / Losses</span>
            <span className="text-white font-semibold text-sm">
              <span className="text-green-400">{wins}</span> / <span className="text-red-400">{losses}</span>
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-700/20">
            <span className="text-gray-400 text-xs">Total Games</span>
            <span className="text-white font-semibold text-sm">{totalGames}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-gray-400 text-xs">Avg KDA</span>
            <span className="text-white font-semibold text-sm">{avgKDA}</span>
          </div>
        </div>
      </div>

      {/* Top Champions Card */}
      {topChampions.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/60 backdrop-blur-xl border border-gray-700/30 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800/50 to-transparent border-b border-gray-700/30 px-4 py-2.5">
            <h3 className="text-base font-bold text-white">Most Played Champions</h3>
          </div>
          <div className="divide-y divide-gray-700/20">
            {topChampions.map(({ championId, champion, games, winRate, kda }) => (
              <div 
                key={championId}
                className="flex items-center gap-3 p-2.5 hover:bg-gray-800/30 transition-colors"
              >
                {champion && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-gray-700/50">
                    <img 
                      src={`https://ddragon.leagueoflegends.com/cdn/${championVersion}/img/champion/${champion.id}.png`}
                      alt={champion.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-xs truncate">
                    {champion?.name || `Champion ${championId}`}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{games} games</span>
                    <span>•</span>
                    <span className={winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                      {winRate}% WR
                    </span>
                    <span>•</span>
                    <span className="text-cyan-400">{kda} KDA</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranked Stats Card */}
      {rankedStats.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/60 backdrop-blur-xl border border-gray-700/30 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800/50 to-transparent border-b border-gray-700/30 px-4 py-2.5">
            <h3 className="text-base font-bold text-white">Ranked Stats</h3>
          </div>
          <div className="divide-y divide-gray-700/20">
            {rankedStats.map((rank) => {
              const winRate = rank.wins + rank.losses > 0
                ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100)
                : 0;
              
              return (
                <div key={rank.queue_type} className="p-2.5 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <img 
                      src={getRankImage(rank.tier)}
                      alt={`${rank.tier} ${rank.rank}`}
                      className="w-10 h-10 object-contain drop-shadow-lg"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-400 text-[10px] mb-0.5">
                      {rank.queue_type === "RANKED_SOLO_5x5" ? "Ranked Solo/Duo" : "Ranked Flex"}
                    </div>
                    <div className="text-white font-bold text-xs">
                      {rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase()} {rank.rank}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span>{rank.league_points} LP</span>
                      <span>•</span>
                      <span className={winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                        {winRate}% WR
                      </span>
                      <span>•</span>
                      <span>{rank.wins}W {rank.losses}L</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

