import type { SummonerInfo, RankedStats } from "../../types";

interface PlayerHeaderProps {
  summonerInfo: SummonerInfo;
  rankedStats: RankedStats[];
  championVersion: string;
}

export default function PlayerHeader({ summonerInfo, rankedStats, championVersion }: PlayerHeaderProps) {
  const getRankImage = (tier: string) => {
    const tierLower = tier.toLowerCase();
    // Use local rank images from public/ranks directory
    return `/ranks/${tierLower}.png`;
  };

  return (
    <div className="bg-black/50 backdrop-blur-xl border-b border-gray-700/30 shadow-lg">
      <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
        {/* Profile Section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-cyan-400/60 shadow-lg">
              <img 
                src={`https://ddragon.leagueoflegends.com/cdn/${championVersion}/img/profileicon/${summonerInfo.profile_icon_id}.png`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold px-2 py-0.5 rounded shadow-lg">
              {summonerInfo.summoner_level}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {summonerInfo.game_name && summonerInfo.tag_line 
                ? `${summonerInfo.game_name}#${summonerInfo.tag_line}`
                : summonerInfo.display_name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span>Online</span>
            </div>
          </div>
        </div>

        {/* Rank Section */}
        {rankedStats.filter(r => r.queue_type === "RANKED_SOLO_5x5").map((rank) => {
          const winRate = rank.wins + rank.losses > 0 
            ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100) 
            : 0;

          return (
            <div key={rank.queue_type} className="flex items-center gap-4">
              <img 
                src={getRankImage(rank.tier)}
                alt={`${rank.tier} ${rank.rank}`}
                className="w-16 h-16 object-contain drop-shadow-lg"
              />
              <div>
                <div className="text-white font-bold text-lg">
                  {rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase()} {rank.rank}
                </div>
                <div className="text-sm text-gray-400">
                  {rank.league_points} LP • {winRate}% WR
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

